begin;

-- Motor reaproveitável de promoção por quantidade. A configuração vive no
-- editor da loja e o cálculo autoritativo acontece no banco, junto da reserva.
alter table public.store_settings
  add column if not exists quantity_promotion jsonb not null default jsonb_build_object(
    'enabled', false,
    'singleProductId', '',
    'boxProductId', '',
    'doseProductId', '',
    'groupQuantity', 3,
    'groupDiscountPercent', 50,
    'doseGiftPerRemainder', 1,
    'boxGiftQuantity', 1,
    'repeatable', true,
    'allowCoupons', false,
    'allowAdditionalDiscounts', false
  );

alter table public.store_settings
  drop constraint if exists store_settings_quantity_promotion_check,
  add constraint store_settings_quantity_promotion_check check (
    jsonb_typeof(quantity_promotion) = 'object'
    and coalesce((quantity_promotion->>'groupQuantity')::integer, 3) between 2 and 20
    and coalesce((quantity_promotion->>'groupDiscountPercent')::numeric, 50) between 0 and 100
    and coalesce((quantity_promotion->>'doseGiftPerRemainder')::integer, 1) between 0 and 20
    and coalesce((quantity_promotion->>'boxGiftQuantity')::integer, 1) between 0 and 20
  );

alter table public.orders
  add column if not exists promotion_discount numeric(12,2) not null default 0,
  add column if not exists promotion_snapshot jsonb not null default '{}'::jsonb;

alter table public.orders
  drop constraint if exists orders_promotion_discount_check,
  add constraint orders_promotion_discount_check check (
    promotion_discount >= 0 and promotion_discount <= subtotal
  );

alter table public.order_items
  add column if not exists is_gift boolean not null default false,
  add column if not exists promotion_rule text not null default '';

-- Itens gratuitos nunca geram cashback. O produto pago continua usando a
-- fotografia de cashback existente e o recálculo líquido do pedido.
create or replace function public.snapshot_order_item_cashback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
  if coalesce(new.is_gift, false) or coalesce(new.is_component, false) or new.unit_price <= 0 then
    new.unit_cashback := 0;
    return new;
  end if;

  select * into v_product
  from public.products product
  where product.tenant_id = new.tenant_id
    and product.id = new.product_id;

  new.unit_cashback := case
    when not found then 0
    when v_product.cashback_type = 'percent' then round(new.unit_price * v_product.cashback / 100, 4)
    else v_product.cashback
  end;
  return new;
end;
$$;

-- O wrapper de checkout precisa alinhar o total financeiro ao total comercial
-- da promoção na mesma transação. A exceção abaixo é restrita ao service_role,
-- ao pedido recém-criado e a um desconto promocional positivo.
create or replace function public.protect_order_control_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(auth.jwt()->>'email', '');
  v_automatic_campaign boolean := auth.role() = 'service_role'
    and old.status = 'Novo'
    and old.promotion_discount = 0
    and new.promotion_discount > 0
    and new.financial_total = new.total;
begin
  if new.financial_total is distinct from old.financial_total then
    if not v_automatic_campaign and not public.has_tenant_permission(new.tenant_id, 'finance') then
      raise exception 'Acesso negado ao ajuste financeiro';
    end if;
    if new.financial_total < 0 or new.financial_total > 1000000000 then
      raise exception 'Valor financeiro inválido';
    end if;
    if not v_automatic_campaign and (
      length(trim(coalesce(new.financial_adjustment_reason, ''))) < 5
      or length(new.financial_adjustment_reason) > 300
    ) then
      raise exception 'Informe um motivo entre 5 e 300 caracteres';
    end if;
    new.financial_adjustment := new.financial_total - new.total;
    if not v_automatic_campaign then
      new.financial_adjusted_at := now();
      new.financial_adjusted_by := v_actor;
    end if;
  elsif new.financial_adjustment is distinct from old.financial_adjustment
    or new.financial_adjustment_reason is distinct from old.financial_adjustment_reason
    or new.financial_adjusted_at is distinct from old.financial_adjusted_at
    or new.financial_adjusted_by is distinct from old.financial_adjusted_by
  then
    raise exception 'Use o ajuste financeiro do pedido';
  end if;

  if new.archived_at is distinct from old.archived_at then
    if not public.has_tenant_permission(new.tenant_id, 'orders') then
      raise exception 'Acesso negado ao arquivo de pedidos';
    end if;
    if new.archived_at is not null and new.status not in ('Entregue', 'Cancelado') then
      raise exception 'Finalize ou cancele o pedido antes de arquivá-lo';
    end if;
    new.archived_by := case when new.archived_at is null then '' else v_actor end;
  elsif new.archived_by is distinct from old.archived_by then
    raise exception 'Use o arquivo de pedidos';
  end if;

  return new;
end;
$$;

create or replace function public.create_tenant_order_with_promotions_secure(
  p_tenant_id uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment text,
  p_coupon_code text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_fingerprint_hash text default '',
  p_source text default 'storefront',
  p_reservation_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings public.store_settings%rowtype;
  v_config jsonb := '{}'::jsonb;
  v_order jsonb;
  v_order_id text;
  v_single_id text := '';
  v_box_id text := '';
  v_dose_id text := '';
  v_single_quantity integer := 0;
  v_box_quantity integer := 0;
  v_group_quantity integer := 3;
  v_groups integer := 0;
  v_remainder integer := 0;
  v_dose_gifts integer := 0;
  v_box_gifts integer := 0;
  v_repeatable boolean := true;
  v_allow_coupons boolean := false;
  v_allow_additional boolean := false;
  v_discount_percent numeric := 50;
  v_promotion_discount numeric(12,2) := 0;
  v_single public.products%rowtype;
  v_dose public.products%rowtype;
  v_available integer := 0;
  v_reserved integer := 0;
  v_old_discount numeric(12,2) := 0;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_new_discount numeric(12,2) := 0;
  v_new_total numeric(12,2) := 0;
  v_gift_message text := '';
  v_snapshot jsonb := '{}'::jsonb;
  v_response jsonb;
  v_active boolean := false;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;

  select * into v_settings from public.store_settings
  where tenant_id = p_tenant_id and id = 'default';
  if not found then raise exception 'Configuração da loja não encontrada'; end if;

  v_config := coalesce(v_settings.quantity_promotion, '{}'::jsonb);
  v_active := coalesce((v_config->>'enabled')::boolean, false)
    and v_settings.promotion_enabled
    and (v_settings.promotion_starts_at is null or v_settings.promotion_starts_at <= now())
    and (v_settings.promotion_ends_at is null or v_settings.promotion_ends_at >= now());

  if v_active then
    v_single_id := coalesce(v_config->>'singleProductId', v_config->>'single_product_id', '');
    v_box_id := coalesce(v_config->>'boxProductId', v_config->>'box_product_id', '');
    v_dose_id := coalesce(v_config->>'doseProductId', v_config->>'dose_product_id', '');
    v_group_quantity := greatest(2, least(20, coalesce((v_config->>'groupQuantity')::integer, 3)));
    v_discount_percent := greatest(0, least(100, coalesce((v_config->>'groupDiscountPercent')::numeric, 50)));
    v_repeatable := coalesce((v_config->>'repeatable')::boolean, true);
    v_allow_coupons := coalesce((v_config->>'allowCoupons')::boolean, false);
    v_allow_additional := coalesce((v_config->>'allowAdditionalDiscounts')::boolean, false);

    select coalesce(sum((item->>'quantity')::integer), 0)::integer into v_single_quantity
    from jsonb_array_elements(p_items) item where item->>'product_id' = v_single_id;
    select coalesce(sum((item->>'quantity')::integer), 0)::integer into v_box_quantity
    from jsonb_array_elements(p_items) item where item->>'product_id' = v_box_id;

    v_groups := case
      when v_repeatable then floor(v_single_quantity::numeric / v_group_quantity)::integer
      when v_single_quantity >= v_group_quantity then 1 else 0 end;
    v_remainder := greatest(0, v_single_quantity - (v_groups * v_group_quantity));
    v_dose_gifts := v_remainder * greatest(0, coalesce((v_config->>'doseGiftPerRemainder')::integer, 1));
    v_box_gifts := v_box_quantity * greatest(0, coalesce((v_config->>'boxGiftQuantity')::integer, 1));

    if v_groups > 0 or v_dose_gifts > 0 or v_box_gifts > 0 then
      if not v_allow_coupons and trim(coalesce(p_coupon_code, '')) <> '' then
        raise exception 'Esta promoção acumula cashback, mas não aceita cupom ou outro desconto';
      end if;

      perform 1 from public.products product
      where product.tenant_id = p_tenant_id and product.id in (v_single_id, v_dose_id)
      order by product.id for update;

      select * into v_single from public.products
      where tenant_id = p_tenant_id and id = v_single_id and active and deleted_at is null;
      if not found then raise exception 'A ampola configurada na promoção está indisponível'; end if;

      v_promotion_discount := round(v_groups * v_single.price * v_discount_percent / 100, 2);

      if v_dose_gifts > 0 then
        select * into v_dose from public.products
        where tenant_id = p_tenant_id and id = v_dose_id and active and deleted_at is null;
        if not found then raise exception 'A dose brinde configurada está indisponível'; end if;
        select coalesce(sum(quantity), 0)::integer into v_reserved
        from public.order_stock_reservations where tenant_id = p_tenant_id and product_id = v_dose_id
          and status = 'active' and expires_at > now();
        v_available := greatest(0, v_dose.stock - v_reserved);
        if v_available < v_dose_gifts then raise exception 'O brinde de 2,5 mg ficou sem estoque suficiente'; end if;
      end if;

      if v_box_gifts > 0 then
        select coalesce(sum(quantity), 0)::integer into v_reserved
        from public.order_stock_reservations where tenant_id = p_tenant_id and product_id = v_single_id
          and status = 'active' and expires_at > now();
        v_available := greatest(0, v_single.stock - v_reserved);
        if v_available < v_single_quantity + v_box_gifts then
          raise exception 'A ampola grátis da caixa ficou sem estoque suficiente';
        end if;
      end if;
    end if;
  end if;

  v_order := public.create_tenant_order_with_bundles_secure(
    p_tenant_id, p_customer, p_items, p_payment,
    case when v_active and not v_allow_coupons then '' else p_coupon_code end,
    p_idempotency_key, p_request_hash, p_fingerprint_hash, p_source, p_reservation_minutes
  );
  if coalesce((v_order->>'idempotent_replay')::boolean, false) then return v_order; end if;
  v_order_id := v_order->>'id';

  if not v_active or (v_groups = 0 and v_dose_gifts = 0 and v_box_gifts = 0) then
    return v_order;
  end if;

  select subtotal, discount, shipping into v_subtotal, v_old_discount, v_shipping
  from public.orders where tenant_id = p_tenant_id and id = v_order_id for update;
  v_new_discount := round(v_promotion_discount + case when v_allow_additional then v_old_discount else 0 end, 2);
  v_new_total := round(greatest(0, v_subtotal - v_new_discount) + v_shipping, 2);

  if v_dose_gifts > 0 then
    insert into public.order_items
      (tenant_id, order_id, product_id, product_name, quantity, unit_price, unit_cost,
       unit_cashback, is_gift, promotion_rule)
    values
      (p_tenant_id, v_order_id, v_dose.id, v_dose.name, v_dose_gifts, 0, v_dose.cost_price,
       0, true, 'single-dose-gift');
    insert into public.order_stock_reservations
      (tenant_id, order_id, product_id, quantity, status, expires_at)
    select p_tenant_id, v_order_id, v_dose.id, v_dose_gifts, 'active', reservation_expires_at
    from public.orders where tenant_id = p_tenant_id and id = v_order_id
    on conflict (tenant_id, order_id, product_id) do update set
      quantity = public.order_stock_reservations.quantity + excluded.quantity,
      status = 'active', expires_at = excluded.expires_at, updated_at = now();
  end if;

  if v_box_gifts > 0 then
    insert into public.order_items
      (tenant_id, order_id, product_id, product_name, quantity, unit_price, unit_cost,
       unit_cashback, is_gift, promotion_rule)
    values
      (p_tenant_id, v_order_id, v_single.id, v_single.name, v_box_gifts, 0, v_single.cost_price,
       0, true, 'box-ampoule-gift');
    insert into public.order_stock_reservations
      (tenant_id, order_id, product_id, quantity, status, expires_at)
    select p_tenant_id, v_order_id, v_single.id, v_box_gifts, 'active', reservation_expires_at
    from public.orders where tenant_id = p_tenant_id and id = v_order_id
    on conflict (tenant_id, order_id, product_id) do update set
      quantity = public.order_stock_reservations.quantity + excluded.quantity,
      status = 'active', expires_at = excluded.expires_at, updated_at = now();
  end if;

  v_gift_message := concat_ws(' · ',
    case when v_dose_gifts > 0 then v_dose_gifts || 'x dose extra de 2,5 mg na seringa' end,
    case when v_box_gifts > 0 then v_box_gifts || 'x ampola grátis pela caixa' end,
    case when v_groups > 0 then v_groups || 'x ampola com ' || trim(to_char(v_discount_percent, 'FM990D##')) || '% OFF' end
  );
  v_snapshot := jsonb_build_object(
    'campaign', v_settings.promotion_name,
    'single_product_id', v_single_id,
    'box_product_id', v_box_id,
    'dose_product_id', v_dose_id,
    'groups', v_groups,
    'dose_gifts', v_dose_gifts,
    'box_gifts', v_box_gifts,
    'discount_percent', v_discount_percent,
    'discount', v_promotion_discount,
    'repeatable', v_repeatable,
    'coupon_applied', false,
    'cashback_preserved', true,
    'calculation_version', 'quantity-promotion-v1'
  );

  update public.orders set
    discount = v_new_discount,
    total = v_new_total,
    financial_total = v_new_total,
    promotion_discount = v_promotion_discount,
    promotion_snapshot = v_snapshot,
    campaign_gift = left(v_gift_message, 180),
    coupon_code = case when v_allow_coupons then coupon_code else '' end
  where tenant_id = p_tenant_id and id = v_order_id;

  perform public.recalculate_order_cashback(p_tenant_id, v_order_id);

  select jsonb_build_object(
    'id', id, 'customer_id', customer_id, 'code', code, 'created_at', created_at,
    'subtotal', subtotal, 'discount', discount, 'shipping', shipping, 'total', total,
    'cashback_total', cashback_total, 'loyalty_discount', loyalty_discount,
    'campaign_gift', campaign_gift, 'promotion_discount', promotion_discount,
    'promotion_snapshot', promotion_snapshot, 'status', status,
    'order_source', order_source, 'reservation_expires_at', reservation_expires_at,
    'shipping_status', shipping_status, 'idempotent_replay', false
  ) into v_response
  from public.orders where tenant_id = p_tenant_id and id = v_order_id;

  update public.storefront_order_requests
  set response_data = v_response, updated_at = now()
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

revoke all on function public.create_tenant_order_with_promotions_secure(
  uuid, jsonb, jsonb, text, text, uuid, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.create_tenant_order_with_promotions_secure(
  uuid, jsonb, jsonb, text, text, uuid, text, text, text, integer
) to service_role;

-- Campanha de setembro: os IDs são os produtos confirmados no catálogo. A
-- ativação começa somente em 01/09; estoque zerado continua bloqueando a venda.
update public.store_settings settings set
  promotion_enabled = true,
  promotion_name = 'Promoção Especial Setembro',
  promotion_starts_at = '2026-09-01 00:00:00-03'::timestamptz,
  promotion_ends_at = '2026-10-01 00:00:00-03'::timestamptz,
  promotion_highlights = jsonb_build_array(
    'Compre 1 ampola de TG 15 mg e ganhe 1 dose extra de 2,5 mg na seringa',
    'A cada 3 ampolas de TG 15 mg, uma recebe 50% OFF',
    'Compre 1 caixa de TG 15 mg e ganhe 1 ampola do mesmo produto'
  ),
  promotion_gift_message = '',
  announcement = 'Setembro especial · Dose extra · 3ª ampola com 50% OFF · Caixa com ampola grátis',
  pix_discount = 0,
  free_shipping_enabled = false,
  loyalty_discount_enabled = false,
  quantity_promotion = jsonb_build_object(
    'enabled', true,
    'singleProductId', 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc',
    'boxProductId', 'tg15',
    'doseProductId', '1024a192-5087-41e6-8f0c-e224ef32bdac',
    'groupQuantity', 3,
    'groupDiscountPercent', 50,
    'doseGiftPerRemainder', 1,
    'boxGiftQuantity', 1,
    'repeatable', true,
    'allowCoupons', false,
    'allowAdditionalDiscounts', false
  ),
  updated_at = now()
where exists (
  select 1 from public.products product
  where product.tenant_id = settings.tenant_id
    and product.id = 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc'
);

notify pgrst, 'reload schema';

commit;
