begin;

-- Produtos podem definir cashback em reais ou percentual. Registros antigos
-- continuam como valor fixo para preservar o comportamento já cadastrado.
alter table public.products
  add column if not exists cashback_type text not null default 'fixed';

alter table public.products
  drop constraint if exists products_cashback_check;
alter table public.products
  drop constraint if exists products_cashback_type_check;
alter table public.products
  add constraint products_cashback_type_check
  check (
    (cashback_type = 'fixed' and cashback >= 0 and cashback <= price)
    or (cashback_type = 'percent' and cashback >= 0 and cashback <= 100)
  );

alter table public.order_items
  alter column unit_cashback type numeric(14,4) using unit_cashback::numeric(14,4);

alter table public.orders
  add column if not exists cashback_campaign_id text
    references public.cashback_campaigns(id) on delete set null;

-- Recalcula a fotografia do cashback prometido no momento do pedido.
-- A base é total - frete, ou seja, somente o valor efetivamente pago pelos
-- produtos depois de cupom e demais descontos.
create or replace function public.recalculate_order_cashback(
  p_tenant_id uuid,
  p_order_id text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_campaign public.cashback_campaigns%rowtype;
  v_segment text;
  v_net_merchandise numeric := 0;
  v_net_ratio numeric := 0;
  v_line record;
  v_line_paid numeric := 0;
  v_line_cashback numeric := 0;
  v_total_cashback numeric := 0;
  v_campaign_bonus_applied boolean := false;
  v_campaign_matches boolean := false;
  v_has_campaign boolean := false;
begin
  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then
    return 0;
  end if;

  v_net_merchandise := greatest(0, coalesce(v_order.total, 0) - coalesce(v_order.shipping, 0));
  v_net_ratio := case
    when coalesce(v_order.subtotal, 0) > 0 then least(1, v_net_merchandise / v_order.subtotal)
    else 0
  end;
  v_segment := public.cashback_customer_segment(v_order.tenant_id, v_order.customer_id, v_order.id);

  select campaign.* into v_campaign
  from public.cashback_campaigns campaign
  where campaign.tenant_id = v_order.tenant_id
    and campaign.status = 'active'
    and campaign.starts_at <= v_order.created_at
    and (campaign.ends_at is null or campaign.ends_at >= v_order.created_at)
    and (cardinality(campaign.target_segments) = 0 or v_segment = any(campaign.target_segments))
    and (
      cardinality(campaign.product_ids) = 0
      or exists (
        select 1
        from public.order_items item
        where item.tenant_id = v_order.tenant_id
          and item.order_id = v_order.id
          and item.product_id = any(campaign.product_ids)
      )
    )
  order by campaign.priority desc, campaign.updated_at desc
  limit 1;
  v_has_campaign := found;

  for v_line in
    select
      item.id,
      item.product_id,
      item.quantity,
      item.unit_price,
      product.cashback,
      product.cashback_type
    from public.order_items item
    join public.products product
      on product.tenant_id = item.tenant_id
     and product.id = item.product_id
    where item.tenant_id = v_order.tenant_id
      and item.order_id = v_order.id
    order by item.id
  loop
    v_line_paid := greatest(0, v_line.quantity * v_line.unit_price * v_net_ratio);
    v_campaign_matches := v_has_campaign and (
      cardinality(v_campaign.product_ids) = 0
      or v_line.product_id = any(v_campaign.product_ids)
    );

    if v_campaign_matches then
      v_line_cashback := v_line_paid * v_campaign.multiplier / 100;
      if not v_campaign_bonus_applied and v_line_paid > 0 and v_campaign.fixed_bonus > 0 then
        v_line_cashback := v_line_cashback + v_campaign.fixed_bonus;
        v_campaign_bonus_applied := true;
      end if;
    elsif v_line.cashback_type = 'percent' then
      v_line_cashback := v_line_paid * v_line.cashback / 100;
    else
      v_line_cashback := v_line.cashback * v_line.quantity * v_net_ratio;
    end if;

    v_line_cashback := greatest(0, round(v_line_cashback, 4));
    update public.order_items
    set unit_cashback = case
      when v_line.quantity > 0 then round(v_line_cashback / v_line.quantity, 4)
      else 0
    end
    where id = v_line.id;
  end loop;

  select round(coalesce(sum(item.quantity * item.unit_cashback), 0), 2)
  into v_total_cashback
  from public.order_items item
  where item.tenant_id = v_order.tenant_id
    and item.order_id = v_order.id;

  update public.orders
  set cashback_total = v_total_cashback,
      cashback_campaign_id = case when v_has_campaign then v_campaign.id else null end
  where tenant_id = v_order.tenant_id and id = v_order.id;

  return v_total_cashback;
end;
$$;

-- O valor inicial é apenas provisório. A reserva criada imediatamente depois
-- dispara o recálculo completo, já conhecendo descontos, frete e campanhas.
create or replace function public.snapshot_order_item_cashback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
begin
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

create or replace function public.recalculate_reserved_order_cashback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_order_cashback(new.tenant_id, new.order_id);
  return new;
end;
$$;

drop trigger if exists recalculate_reserved_order_cashback on public.order_stock_reservations;
create trigger recalculate_reserved_order_cashback
after insert on public.order_stock_reservations
for each row execute function public.recalculate_reserved_order_cashback();

-- Devolve o valor autoritativo ao checkout para a mensagem do WhatsApp usar
-- exatamente o mesmo cashback que ficou gravado no pedido.
do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.create_tenant_order_secure(uuid,jsonb,jsonb,text,text,uuid,text,text,text,integer)'::regprocedure
  ) into current_definition;

  if position('''cashback_total''' in current_definition) = 0 then
    updated_definition := replace(
      current_definition,
      '''total'', v_total,',
      '''total'', v_total,' || chr(10)
        || '    ''cashback_total'', (select cashback_total from public.orders where tenant_id = p_tenant_id and id = v_order_id),' || chr(10)
        || '    ''cashback_campaign_id'', (select cashback_campaign_id from public.orders where tenant_id = p_tenant_id and id = v_order_id),'
    );

    if updated_definition = current_definition
      or position('''cashback_campaign_id''' in updated_definition) = 0
    then
      raise exception 'Não foi possível incluir o cashback no retorno do checkout seguro';
    end if;

    execute updated_definition;
  end if;
end;
$$;

-- O cashback total já contém o resultado da campanha. A carteira recebe um
-- único crédito para impedir a soma duplicada de produto + campanha.
create or replace function public.sync_order_cashback_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.cashback_campaigns%rowtype;
  v_credit record;
  v_reversal_id uuid;
  v_remaining numeric := 0;
  v_has_campaign boolean := false;
begin
  if new.customer_id is null or new.customer_id = '' then return new; end if;

  if new.status in ('Pago', 'Entregue') and coalesce(new.cashback_total, 0) > 0 then
    if new.cashback_campaign_id is not null then
      select * into v_campaign
      from public.cashback_campaigns
      where tenant_id = new.tenant_id and id = new.cashback_campaign_id;
      v_has_campaign := found;
    end if;

    insert into public.cashback_entries
      (tenant_id, customer_id, kind, amount, description, order_id, campaign_id, expires_at, metadata)
    values
      (
        new.tenant_id,
        new.customer_id,
        'order_credit',
        round(new.cashback_total, 2),
        'Cashback do pedido ' || new.code,
        new.id,
        case when v_has_campaign then v_campaign.id else null end,
        now() + make_interval(days => case when v_has_campaign then v_campaign.credit_valid_days else 90 end),
        jsonb_build_object(
          'order_code', new.code,
          'cashback_total', new.cashback_total,
          'calculation_base', greatest(0, new.total - new.shipping),
          'excludes_shipping', true,
          'campaign_replaces_product', new.cashback_campaign_id is not null
        )
      )
    on conflict do nothing;
  end if;

  if new.status = 'Cancelado' and (tg_op = 'INSERT' or old.status <> 'Cancelado') then
    for v_credit in
      select entry.id, entry.amount, entry.description,
        greatest(0, entry.amount - coalesce((
          select sum(allocation.amount)
          from public.cashback_allocations allocation
          where allocation.tenant_id = entry.tenant_id
            and allocation.credit_entry_id = entry.id
        ), 0)) as remaining
      from public.cashback_entries entry
      where entry.tenant_id = new.tenant_id
        and entry.order_id = new.id
        and entry.kind in ('order_credit', 'campaign_bonus')
      order by entry.created_at
    loop
      insert into public.cashback_entries
        (tenant_id, customer_id, kind, amount, description, order_id, reference_entry_id, metadata)
      values
        (
          new.tenant_id,
          new.customer_id,
          'order_reversal',
          v_credit.amount,
          'Estorno por cancelamento do pedido ' || new.code,
          new.id,
          v_credit.id,
          jsonb_build_object('order_code', new.code, 'reversed_description', v_credit.description)
        )
      on conflict do nothing
      returning id into v_reversal_id;

      if v_reversal_id is not null then
        v_remaining := least(v_credit.amount, v_credit.remaining);
        if v_remaining > 0 then
          insert into public.cashback_allocations
            (tenant_id, credit_entry_id, consumption_entry_id, amount)
          values (new.tenant_id, v_credit.id, v_reversal_id, v_remaining)
          on conflict do nothing;
        end if;
      end if;
      v_reversal_id := null;
    end loop;
  end if;

  return new;
end;
$$;

-- Mantém as avaliações antigas somente como histórico administrativo e
-- encerra leitura pública, novos convites e novos envios.
drop policy if exists "Vitrines públicas podem ver avaliações aprovadas" on public.product_reviews;
drop policy if exists "Qualquer pessoa com o token pode inserir avaliação" on public.product_reviews;
drop policy if exists "Administradores podem gerenciar todas as avaliações" on public.product_reviews;
create policy "Administradores podem consultar o histórico de avaliações"
  on public.product_reviews
  for select
  to authenticated
  using (public.has_tenant_permission(tenant_id, 'catalog'));

revoke all on table public.product_reviews from anon;
revoke insert, update, delete on table public.product_reviews from authenticated;
grant select on table public.product_reviews to authenticated;

-- Allowlist pública sem métricas de avaliação e com o novo tipo de cashback.
drop view if exists public.storefront_products;
create view public.storefront_products
with (security_barrier = true, security_invoker = false)
as
with availability as (
  select
    product.tenant_id,
    product.id,
    greatest(
      0,
      product.stock - coalesce(sum(reservation.quantity) filter (
        where reservation.status = 'active' and reservation.expires_at > now()
      ), 0)
    )::integer as available_quantity
  from public.products product
  left join public.order_stock_reservations reservation
    on reservation.tenant_id = product.tenant_id
   and reservation.product_id = product.id
  group by product.tenant_id, product.id, product.stock
)
select
  product.tenant_id,
  product.id,
  product.slug,
  product.name,
  product.category_id,
  product.brand,
  product.price,
  product.compare_at,
  product.cashback,
  product.cashback_type,
  product.badge,
  product.accent,
  product.description,
  product.featured,
  product.active,
  product.order_index,
  product.image_url,
  product.image_urls,
  product.product_type,
  product.regulatory_status,
  product.active_ingredient,
  product.anvisa_registration,
  product.presentation,
  product.regulatory_warning,
  product.pharmacist_reviewed,
  case
    when availability.available_quantity <= 0 then 'out_of_stock'
    when availability.available_quantity <= 5 then 'low_stock'
    else 'in_stock'
  end as availability,
  case
    when availability.available_quantity <= 0 then 0
    when availability.available_quantity <= 5 then 1
    when availability.available_quantity <= 10 then 5
    else 10
  end as purchase_limit
from public.products product
join public.tenants tenant on tenant.id = product.tenant_id
join availability on availability.tenant_id = product.tenant_id and availability.id = product.id
where product.active = true
  and tenant.status in ('trial', 'active');

revoke all on table public.storefront_products from public, anon, authenticated;
grant select on table public.storefront_products to anon, authenticated;

revoke all on function public.recalculate_order_cashback(uuid, text) from public, anon, authenticated;
revoke all on function public.recalculate_reserved_order_cashback() from public, anon, authenticated;
grant execute on function public.recalculate_order_cashback(uuid, text) to service_role;

commit;
