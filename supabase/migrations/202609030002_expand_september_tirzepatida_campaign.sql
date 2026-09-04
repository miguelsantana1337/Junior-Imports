begin;

-- A segunda versão do motor mantém compatibilidade com o par legado e aceita
-- várias ampolas avulsas e vários pares caixa -> ampola da mesma marca.
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
  v_single_ids jsonb := '[]'::jsonb;
  v_box_mappings jsonb := '[]'::jsonb;
  v_lock_ids text[] := '{}'::text[];
  v_single_id text := '';
  v_box_id text := '';
  v_gift_id text := '';
  v_dose_id text := '';
  v_single_quantity integer := 0;
  v_box_quantity integer := 0;
  v_paid_gift_quantity integer := 0;
  v_group_quantity integer := 3;
  v_groups integer := 0;
  v_remainder integer := 0;
  v_dose_gifts integer := 0;
  v_box_gifts integer := 0;
  v_box_gifts_for_mapping integer := 0;
  v_repeatable boolean := true;
  v_allow_coupons boolean := false;
  v_allow_additional boolean := false;
  v_discount_percent numeric := 50;
  v_promotion_discount numeric := 0;
  v_single public.products%rowtype;
  v_box public.products%rowtype;
  v_dose public.products%rowtype;
  v_gift public.products%rowtype;
  v_available integer := 0;
  v_reserved integer := 0;
  v_old_discount numeric(12,2) := 0;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_new_discount numeric(12,2) := 0;
  v_new_total numeric(12,2) := 0;
  v_gift_message text := '';
  v_snapshot jsonb := '{}'::jsonb;
  v_single_breakdown jsonb := '[]'::jsonb;
  v_box_gift_breakdown jsonb := '[]'::jsonb;
  v_mapping jsonb;
  v_gift_row record;
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
    v_dose_id := coalesce(v_config->>'doseProductId', v_config->>'dose_product_id', '');
    v_group_quantity := greatest(2, least(20, coalesce((v_config->>'groupQuantity')::integer, 3)));
    v_discount_percent := greatest(0, least(100, coalesce((v_config->>'groupDiscountPercent')::numeric, 50)));
    v_repeatable := coalesce((v_config->>'repeatable')::boolean, true);
    v_allow_coupons := coalesce((v_config->>'allowCoupons')::boolean, false);
    v_allow_additional := coalesce((v_config->>'allowAdditionalDiscounts')::boolean, false);

    if jsonb_typeof(v_config->'singleProductIds') = 'array' then
      v_single_ids := v_config->'singleProductIds';
    end if;
    if jsonb_array_length(v_single_ids) = 0
      and length(coalesce(v_config->>'singleProductId', v_config->>'single_product_id', '')) > 0
    then
      v_single_ids := jsonb_build_array(coalesce(v_config->>'singleProductId', v_config->>'single_product_id'));
    end if;
    select coalesce(jsonb_agg(product_id order by product_id), '[]'::jsonb)
    into v_single_ids
    from (
      select distinct trim(value) as product_id
      from jsonb_array_elements_text(v_single_ids)
      where length(trim(value)) > 0
    ) configured_singles;

    if jsonb_typeof(v_config->'boxProductMappings') = 'array' then
      v_box_mappings := v_config->'boxProductMappings';
    end if;
    if jsonb_array_length(v_box_mappings) = 0
      and length(coalesce(v_config->>'boxProductId', v_config->>'box_product_id', '')) > 0
      and jsonb_array_length(v_single_ids) > 0
    then
      v_box_mappings := jsonb_build_array(jsonb_build_object(
        'boxProductId', coalesce(v_config->>'boxProductId', v_config->>'box_product_id'),
        'giftProductId', coalesce(v_config->>'singleProductId', v_config->>'single_product_id')
      ));
    end if;
    select coalesce(
      jsonb_agg(
        jsonb_build_object('boxProductId', box_product_id, 'giftProductId', gift_product_id)
        order by box_product_id, gift_product_id
      ),
      '[]'::jsonb
    )
    into v_box_mappings
    from (
      select distinct
        trim(mapping->>'boxProductId') as box_product_id,
        trim(mapping->>'giftProductId') as gift_product_id
      from jsonb_array_elements(v_box_mappings) mapping
      where length(trim(coalesce(mapping->>'boxProductId', ''))) > 0
        and length(trim(coalesce(mapping->>'giftProductId', ''))) > 0
    ) configured_boxes;

    with configured_product_ids as (
      select value as product_id from jsonb_array_elements_text(v_single_ids)
      union
      select mapping->>'boxProductId' from jsonb_array_elements(v_box_mappings) mapping
      union
      select mapping->>'giftProductId' from jsonb_array_elements(v_box_mappings) mapping
      union
      select v_dose_id
    )
    select coalesce(array_agg(product_id order by product_id), '{}'::text[])
    into v_lock_ids
    from configured_product_ids
    where length(product_id) > 0;

    perform 1
    from public.products product
    where product.tenant_id = p_tenant_id
      and product.id = any(v_lock_ids)
    order by product.id
    for update;

    for v_single_id in
      select value from jsonb_array_elements_text(v_single_ids)
    loop
      select coalesce(sum((item->>'quantity')::integer), 0)::integer
      into v_single_quantity
      from jsonb_array_elements(p_items) item
      where item->>'product_id' = v_single_id;
      continue when v_single_quantity <= 0;

      select * into v_single
      from public.products product
      where product.tenant_id = p_tenant_id
        and product.id = v_single_id
        and product.active
        and product.deleted_at is null;
      if not found then raise exception 'Uma ampola configurada na promoção está indisponível'; end if;

      v_groups := case
        when v_repeatable then floor(v_single_quantity::numeric / v_group_quantity)::integer
        when v_single_quantity >= v_group_quantity then 1 else 0 end;
      v_remainder := greatest(0, v_single_quantity - (v_groups * v_group_quantity));
      v_dose_gifts := v_dose_gifts
        + v_remainder * greatest(0, coalesce((v_config->>'doseGiftPerRemainder')::integer, 1));
      v_promotion_discount := v_promotion_discount
        + v_groups * v_single.price * v_discount_percent / 100;
      v_single_breakdown := v_single_breakdown || jsonb_build_array(jsonb_build_object(
        'product_id', v_single.id,
        'product_name', v_single.name,
        'quantity', v_single_quantity,
        'groups', v_groups,
        'remainder', v_remainder,
        'discount', round(v_groups * v_single.price * v_discount_percent / 100, 2)
      ));
    end loop;

    for v_mapping in
      select value from jsonb_array_elements(v_box_mappings)
    loop
      v_box_id := v_mapping->>'boxProductId';
      v_gift_id := v_mapping->>'giftProductId';
      select coalesce(sum((item->>'quantity')::integer), 0)::integer
      into v_box_quantity
      from jsonb_array_elements(p_items) item
      where item->>'product_id' = v_box_id;
      continue when v_box_quantity <= 0;

      select * into v_box
      from public.products product
      where product.tenant_id = p_tenant_id
        and product.id = v_box_id
        and product.active
        and product.deleted_at is null;
      if not found then raise exception 'Uma caixa configurada na promoção está indisponível'; end if;

      select * into v_gift
      from public.products product
      where product.tenant_id = p_tenant_id
        and product.id = v_gift_id
        and product.active
        and product.deleted_at is null;
      if not found then raise exception 'A ampola grátis da mesma marca está indisponível'; end if;

      v_box_gifts_for_mapping := v_box_quantity
        * greatest(0, coalesce((v_config->>'boxGiftQuantity')::integer, 1));
      v_box_gifts := v_box_gifts + v_box_gifts_for_mapping;
      v_box_gift_breakdown := v_box_gift_breakdown || jsonb_build_array(jsonb_build_object(
        'box_product_id', v_box.id,
        'box_product_name', v_box.name,
        'gift_product_id', v_gift.id,
        'gift_product_name', v_gift.name,
        'quantity', v_box_gifts_for_mapping
      ));
    end loop;

    if v_groups > 0 or v_dose_gifts > 0 or v_box_gifts > 0
      or jsonb_array_length(v_single_breakdown) > 0
    then
      if not v_allow_coupons and trim(coalesce(p_coupon_code, '')) <> '' then
        raise exception 'Esta promoção acumula cashback, mas não aceita cupom ou outro desconto';
      end if;

      if v_dose_gifts > 0 then
        select * into v_dose
        from public.products product
        where product.tenant_id = p_tenant_id
          and product.id = v_dose_id
          and product.active
          and product.deleted_at is null;
        if not found then raise exception 'A dose brinde configurada está indisponível'; end if;
        select coalesce(sum((item->>'quantity')::integer), 0)::integer
        into v_paid_gift_quantity
        from jsonb_array_elements(p_items) item
        where item->>'product_id' = v_dose_id;
        select coalesce(sum(quantity), 0)::integer into v_reserved
        from public.order_stock_reservations
        where tenant_id = p_tenant_id
          and product_id = v_dose_id
          and status = 'active'
          and expires_at > now();
        v_available := greatest(0, v_dose.stock - v_reserved);
        if v_available < v_paid_gift_quantity + v_dose_gifts then
          raise exception 'O brinde de 2,5 mg ficou sem estoque suficiente';
        end if;
      end if;

      for v_gift_row in
        select
          gift->>'gift_product_id' as product_id,
          sum((gift->>'quantity')::integer)::integer as quantity
        from jsonb_array_elements(v_box_gift_breakdown) gift
        group by gift->>'gift_product_id'
        order by gift->>'gift_product_id'
      loop
        select * into v_gift
        from public.products product
        where product.tenant_id = p_tenant_id
          and product.id = v_gift_row.product_id
          and product.active
          and product.deleted_at is null;
        if not found then raise exception 'A ampola grátis da mesma marca está indisponível'; end if;
        select coalesce(sum((item->>'quantity')::integer), 0)::integer
        into v_paid_gift_quantity
        from jsonb_array_elements(p_items) item
        where item->>'product_id' = v_gift_row.product_id;
        select coalesce(sum(quantity), 0)::integer into v_reserved
        from public.order_stock_reservations
        where tenant_id = p_tenant_id
          and product_id = v_gift_row.product_id
          and status = 'active'
          and expires_at > now();
        v_available := greatest(0, v_gift.stock - v_reserved);
        if v_available < v_paid_gift_quantity + v_gift_row.quantity then
          raise exception 'A ampola grátis da mesma marca ficou sem estoque suficiente';
        end if;
      end loop;
    end if;
  end if;

  v_order := public.create_tenant_order_with_bundles_secure(
    p_tenant_id, p_customer, p_items, p_payment,
    case when v_active and not v_allow_coupons then '' else p_coupon_code end,
    p_idempotency_key, p_request_hash, p_fingerprint_hash, p_source, p_reservation_minutes
  );
  if coalesce((v_order->>'idempotent_replay')::boolean, false) then return v_order; end if;
  v_order_id := v_order->>'id';

  if not v_active or (
    v_promotion_discount = 0
    and v_dose_gifts = 0
    and v_box_gifts = 0
  ) then
    return v_order;
  end if;

  v_promotion_discount := round(v_promotion_discount, 2);
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

  for v_gift_row in
    select
      gift->>'gift_product_id' as product_id,
      sum((gift->>'quantity')::integer)::integer as quantity
    from jsonb_array_elements(v_box_gift_breakdown) gift
    group by gift->>'gift_product_id'
    order by gift->>'gift_product_id'
  loop
    select * into v_gift
    from public.products product
    where product.tenant_id = p_tenant_id and product.id = v_gift_row.product_id;
    insert into public.order_items
      (tenant_id, order_id, product_id, product_name, quantity, unit_price, unit_cost,
       unit_cashback, is_gift, promotion_rule)
    values
      (p_tenant_id, v_order_id, v_gift.id, v_gift.name, v_gift_row.quantity, 0, v_gift.cost_price,
       0, true, 'box-ampoule-gift');
    insert into public.order_stock_reservations
      (tenant_id, order_id, product_id, quantity, status, expires_at)
    select p_tenant_id, v_order_id, v_gift.id, v_gift_row.quantity, 'active', reservation_expires_at
    from public.orders where tenant_id = p_tenant_id and id = v_order_id
    on conflict (tenant_id, order_id, product_id) do update set
      quantity = public.order_stock_reservations.quantity + excluded.quantity,
      status = 'active', expires_at = excluded.expires_at, updated_at = now();
  end loop;

  v_gift_message := concat_ws(' · ',
    case when v_dose_gifts > 0 then v_dose_gifts || 'x dose extra de 2,5 mg na seringa' end,
    case when v_box_gifts > 0 then v_box_gifts || 'x ampola grátis da mesma marca' end,
    case when v_promotion_discount > 0 then
      (select coalesce(sum((rule->>'groups')::integer), 0) from jsonb_array_elements(v_single_breakdown) rule)
      || 'x ampola com ' || trim(to_char(v_discount_percent, 'FM990D##')) || '% OFF'
    end
  );
  v_snapshot := jsonb_build_object(
    'campaign', v_settings.promotion_name,
    'single_product_ids', v_single_ids,
    'box_product_mappings', v_box_mappings,
    'dose_product_id', v_dose_id,
    'single_rules', v_single_breakdown,
    'box_gifts', v_box_gift_breakdown,
    'dose_gifts', v_dose_gifts,
    'discount_percent', v_discount_percent,
    'discount', v_promotion_discount,
    'repeatable', v_repeatable,
    'mixes_brands_for_group', false,
    'coupon_applied', false,
    'cashback_preserved', true,
    'calculation_version', 'quantity-promotion-v2-multibrand'
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

do $$
declare
  v_tenant_id uuid;
  v_category_id text;
  v_settings public.store_settings%rowtype;
  v_campaign public.cashback_campaigns%rowtype;
  v_product_ids text[];
  v_product_count integer := 0;
  v_scenario_count integer := 0;
  v_single_ids jsonb := jsonb_build_array(
    'ca6470d1-62f9-4693-806e-4772726d196c',
    '2423f749-ee82-47c6-a1de-d28c5fefaa6e',
    '80fa07fe-f9bf-4663-a967-bb77a767dbeb',
    '582a0969-2c9a-498f-b7bf-6453e784ea18',
    'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc',
    '64234892-ad2d-449a-a47f-9a0e3b53abb7',
    '49982ffd-45c2-49f9-a9e2-5aee0a71154c',
    '25ef2370-51d5-4dfc-abbf-3e147766d206'
  );
  v_box_mappings jsonb := jsonb_build_array(
    jsonb_build_object('boxProductId', '1e6f7da0-1929-4453-b481-61b1aa63bd9d', 'giftProductId', 'ca6470d1-62f9-4693-806e-4772726d196c'),
    jsonb_build_object('boxProductId', 'lipoland15', 'giftProductId', '2423f749-ee82-47c6-a1de-d28c5fefaa6e'),
    jsonb_build_object('boxProductId', '25c8767f-f30a-48cb-8f19-c291c7f97bb4', 'giftProductId', '80fa07fe-f9bf-4663-a967-bb77a767dbeb'),
    jsonb_build_object('boxProductId', 'slimex15', 'giftProductId', '582a0969-2c9a-498f-b7bf-6453e784ea18'),
    jsonb_build_object('boxProductId', 'tg15', 'giftProductId', 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc'),
    jsonb_build_object('boxProductId', 'tirzec15', 'giftProductId', '64234892-ad2d-449a-a47f-9a0e3b53abb7'),
    jsonb_build_object('boxProductId', '030ec321-fcfa-4b51-b2b4-0866b26c14d0', 'giftProductId', '49982ffd-45c2-49f9-a9e2-5aee0a71154c'),
    jsonb_build_object('boxProductId', 'f4fd14e6-dd8c-440e-a389-8d21c29a32b2', 'giftProductId', '25ef2370-51d5-4dfc-abbf-3e147766d206')
  );
  v_dose_id text := '1024a192-5087-41e6-8f0c-e224ef32bdac';
begin
  select tenant.id into v_tenant_id
  from public.tenants tenant
  where tenant.slug = 'junior-imports'
  limit 1;
  if v_tenant_id is null then raise exception 'Loja Junior Imports não encontrada'; end if;

  select category.id into v_category_id
  from public.categories category
  where category.tenant_id = v_tenant_id
    and category.slug = 'tirzepatidas'
    and category.active = true
  limit 1;
  if v_category_id is null then raise exception 'Categoria Tirzepatidas ativa não encontrada'; end if;

  select
    array_agg(product.id order by product.id),
    count(*)::integer
  into v_product_ids, v_product_count
  from public.products product
  where product.tenant_id = v_tenant_id
    and product.category_id = v_category_id
    and product.active = true
    and product.deleted_at is null;
  if v_product_count <> 27 then
    raise exception 'O escopo Tirzepatidas mudou: esperados 27 produtos ativos, encontrados %', v_product_count;
  end if;

  if exists (
    select 1
    from public.products product
    where product.tenant_id = v_tenant_id
      and product.id = any(v_product_ids)
      and (product.price <= 0 or product.cost_price is null or product.cost_price <= 0)
  ) then
    raise exception 'Há tirzepatida sem preço ou custo válido para a validação financeira';
  end if;

  if (
    select count(distinct product.id)
    from public.products product
    where product.tenant_id = v_tenant_id
      and product.category_id = v_category_id
      and product.active = true
      and product.deleted_at is null
      and product.id in (
        select value from jsonb_array_elements_text(v_single_ids)
        union all
        select mapping->>'boxProductId' from jsonb_array_elements(v_box_mappings) mapping
        union all
        select mapping->>'giftProductId' from jsonb_array_elements(v_box_mappings) mapping
        union all
        select v_dose_id
      )
  ) <> 17 then
    raise exception 'O mapeamento das apresentações de tirzepatida está incompleto';
  end if;

  select settings.* into v_settings
  from public.store_settings settings
  where settings.tenant_id = v_tenant_id and settings.id = 'default'
  for update;
  if not found
    or v_settings.promotion_enabled is not true
    or v_settings.promotion_name is distinct from 'Promoção Especial Setembro'
    or v_settings.promotion_ends_at is null
    or v_settings.promotion_ends_at <= clock_timestamp()
  then
    raise exception 'Campanha de setembro não está apta para ampliação';
  end if;

  select campaign.* into v_campaign
  from public.cashback_campaigns campaign
  where campaign.tenant_id = v_tenant_id
    and campaign.id = 'cashback-september-2026'
  for update;
  if not found
    or v_campaign.status <> 'active'
    or v_campaign.ends_at is null
    or v_campaign.ends_at <= clock_timestamp()
    or v_campaign.multiplier <> 1
    or v_campaign.fixed_bonus <> 0
  then
    raise exception 'Cashback de setembro não está apto para o novo escopo';
  end if;

  update public.store_settings
  set
    promotion_highlights = jsonb_build_array(
      'Compre 1 ampola de tirzepatida 15 mg e ganhe 1 dose extra de 2,5 mg na seringa',
      'A cada 3 ampolas de tirzepatida 15 mg da mesma marca, uma recebe 50% OFF',
      'Compre 1 caixa com 4 ampolas de tirzepatida 15 mg e ganhe 1 ampola da mesma marca'
    ),
    quantity_promotion = jsonb_build_object(
      'enabled', true,
      'singleProductId', 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc',
      'boxProductId', 'tg15',
      'singleProductIds', v_single_ids,
      'boxProductMappings', v_box_mappings,
      'doseProductId', v_dose_id,
      'scopeCategoryId', v_category_id,
      'scopeCategorySlug', 'tirzepatidas',
      'groupQuantity', 3,
      'groupDiscountPercent', 50,
      'doseGiftPerRemainder', 1,
      'boxGiftQuantity', 1,
      'repeatable', true,
      'allowCoupons', false,
      'allowAdditionalDiscounts', false,
      'mixBrandsForGroup', false,
      'calculationVersion', 'quantity-promotion-v2-multibrand'
    ),
    free_shipping_banner_eyebrow = 'SETEMBRO ESPECIAL',
    free_shipping_banner_title = 'Condições exclusivas em tirzepatidas 15 mg.',
    free_shipping_banner_subtitle = 'Dose extra de 2,5 mg, terceira ampola da mesma marca com 50% OFF e caixa com ampola da mesma marca grátis.',
    free_shipping_banner_button_text = 'Ver tirzepatidas',
    free_shipping_banner_button_link = '#catalogo',
    announcement = 'Setembro especial em tirzepatidas · Dose extra · 3ª ampola da mesma marca com 50% OFF · Caixa com ampola grátis',
    updated_at = clock_timestamp()
  where tenant_id = v_tenant_id and id = 'default';

  update public.home_sections
  set
    eyebrow = 'SETEMBRO ESPECIAL',
    title = 'Condições exclusivas em tirzepatidas 15 mg.',
    subtitle = 'Dose extra de 2,5 mg, terceira ampola da mesma marca com 50% OFF e caixa com ampola da mesma marca grátis.',
    button_text = 'Ver tirzepatidas',
    button_link = '#catalogo',
    updated_at = clock_timestamp()
  where tenant_id = v_tenant_id and kind = 'promo';

  update public.page_blocks
  set
    eyebrow = 'SETEMBRO ESPECIAL',
    title = 'Condições exclusivas em tirzepatidas 15 mg.',
    body = E'1 ampola de 15 mg: ganhe 1 dose extra de 2,5 mg na seringa.\nA cada 3 ampolas de 15 mg da mesma marca: uma recebe 50% OFF.\n1 caixa com 4 ampolas de 15 mg: ganhe 1 ampola da mesma marca.\nPromoção + 1% de cashback, sem cupom ou desconto adicional.',
    button_text = 'Ver tirzepatidas',
    button_link = '#catalogo',
    updated_at = clock_timestamp()
  where tenant_id = v_tenant_id and kind = 'promo' and page_id = 'home';

  -- Alterar o escopo cria uma nova revisão e exige nova aprovação financeira.
  update public.cashback_campaigns
  set
    status = 'draft',
    product_ids = v_product_ids,
    category_ids = array[v_category_id]::text[],
    updated_at = clock_timestamp()
  where tenant_id = v_tenant_id and id = 'cashback-september-2026'
  returning * into v_campaign;

  with category_products as (
    select product.*
    from public.products product
    where product.tenant_id = v_tenant_id
      and product.id = any(v_product_ids)
  ), single_products as (
    select product.*
    from public.products product
    join jsonb_array_elements_text(v_single_ids) configured(id)
      on configured.id = product.id
    where product.tenant_id = v_tenant_id
  ), box_pairs as (
    select box_product.*, gift_product.id as gift_id, gift_product.name as gift_name,
      gift_product.cost_price as gift_cost
    from jsonb_array_elements(v_box_mappings) mapping
    join public.products box_product
      on box_product.tenant_id = v_tenant_id
     and box_product.id = mapping->>'boxProductId'
    join public.products gift_product
      on gift_product.tenant_id = v_tenant_id
     and gift_product.id = mapping->>'giftProductId'
  ), dose_product as (
    select product.*
    from public.products product
    where product.tenant_id = v_tenant_id and product.id = v_dose_id
  ), scenario_values as (
    select
      'cashback-' || product.id as scenario_key,
      'Cashback de 1% — ' || product.name as scenario_label,
      'cashback'::text as scenario_kind,
      product.id as product_id,
      product.name as product_name,
      ''::text as gift_product_id,
      ''::text as gift_product_name,
      1::integer as quantity,
      product.price as gross_amount,
      0::numeric as discount_amount,
      product.price as paid_amount,
      round(product.price * 0.01, 2) as cashback_amount,
      product.cost_price as cost_amount
    from category_products product
    union all
    select
      'single-dose-gift-' || product.id,
      '1 ampola + dose de 2,5 mg — ' || product.name,
      'single-dose-gift',
      product.id,
      product.name,
      dose.id,
      dose.name,
      1,
      product.price,
      0,
      product.price,
      round(product.price * 0.01, 2),
      product.cost_price + dose.cost_price
    from single_products product cross join dose_product dose
    union all
    select
      'three-single-fifty-percent-' || product.id,
      '3 ampolas com uma a 50% — ' || product.name,
      'three-single-fifty-percent',
      product.id,
      product.name,
      '',
      '',
      3,
      product.price * 3,
      product.price * 0.5,
      product.price * 2.5,
      round(product.price * 2.5 * 0.01, 2),
      product.cost_price * 3
    from single_products product
    union all
    select
      'box-same-brand-gift-' || box.id,
      'Caixa + ampola da mesma marca — ' || box.name,
      'box-same-brand-gift',
      box.id,
      box.name,
      box.gift_id,
      box.gift_name,
      1,
      box.price,
      0,
      box.price,
      round(box.price * 0.01, 2),
      box.cost_price + box.gift_cost
    from box_pairs box
  ), scenarios as (
    select
      scenario_values.*,
      round(paid_amount - cashback_amount - cost_amount, 2) as margin_amount,
      round(((paid_amount - cashback_amount - cost_amount) / nullif(paid_amount, 0)) * 100, 2) as margin_percent
    from scenario_values
  )
  insert into public.campaign_financial_simulations (
    tenant_id, campaign_id, campaign_revision, calculation_version,
    scenario_key, scenario_label, input, result,
    paid_amount, discount_amount, cashback_amount, cost_amount,
    margin_amount, margin_percent, decision, warnings
  )
  select
    v_tenant_id,
    v_campaign.id,
    v_campaign.published_revision,
    'commerce-v2-quantity-promotion-v2',
    scenario.scenario_key,
    scenario.scenario_label,
    jsonb_build_object(
      'campaignId', v_campaign.id,
      'scope', 'tirzepatidas',
      'scenarioKind', scenario.scenario_kind,
      'productId', scenario.product_id,
      'productName', scenario.product_name,
      'giftProductId', scenario.gift_product_id,
      'giftProductName', scenario.gift_product_name,
      'quantity', scenario.quantity,
      'cashbackPercent', 1,
      'minimumMarginPercent', 0,
      'mixesBrandsForGroup', false
    ),
    jsonb_build_object(
      'gross', round(scenario.gross_amount, 2),
      'discount', round(scenario.discount_amount, 2),
      'paidProducts', round(scenario.paid_amount, 2),
      'shipping', 0,
      'cashback', round(scenario.cashback_amount, 2),
      'cost', round(scenario.cost_amount, 2),
      'margin', scenario.margin_amount,
      'marginPercent', scenario.margin_percent,
      'decision', 'approved',
      'warnings', jsonb_build_array()
    ),
    round(scenario.paid_amount, 2),
    round(scenario.discount_amount, 2),
    round(scenario.cashback_amount, 2),
    round(scenario.cost_amount, 2),
    scenario.margin_amount,
    scenario.margin_percent,
    'approved',
    '{}'::text[]
  from scenarios scenario
  where scenario.margin_amount >= 0;

  get diagnostics v_scenario_count = row_count;
  if v_scenario_count <> v_product_count + 24 then
    raise exception 'A validação financeira não aprovou todos os 51 cenários da campanha';
  end if;

  update public.cashback_campaigns
  set status = 'active', updated_at = clock_timestamp()
  where tenant_id = v_tenant_id and id = v_campaign.id
  returning * into v_campaign;

  if v_campaign.status <> 'active'
    or v_campaign.guardian_status <> 'approved'
    or cardinality(v_campaign.product_ids) <> 27
    or cardinality(v_campaign.category_ids) <> 1
    or v_campaign.category_ids[1] <> v_category_id
    or exists (
      select 1
      from public.products product
      where product.tenant_id = v_tenant_id
        and product.id = any(v_campaign.product_ids)
        and product.category_id <> v_category_id
    )
  then
    raise exception 'A campanha não atingiu o escopo final de Tirzepatidas';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
