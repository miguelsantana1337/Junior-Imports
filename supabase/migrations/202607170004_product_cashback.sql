-- Cashback por produto e fotografia do benefício prometido em cada pedido.

alter table public.products
  add column if not exists cashback numeric(12,2) not null default 0;

alter table public.order_items
  add column if not exists unit_cashback numeric(12,2) not null default 0;

alter table public.orders
  add column if not exists cashback_total numeric(12,2) not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_cashback_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_cashback_check check (cashback >= 0 and cashback <= price);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_unit_cashback_check' and conrelid = 'public.order_items'::regclass) then
    alter table public.order_items add constraint order_items_unit_cashback_check check (unit_cashback >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'orders_cashback_total_check' and conrelid = 'public.orders'::regclass) then
    alter table public.orders add constraint orders_cashback_total_check check (cashback_total >= 0);
  end if;
end $$;

create or replace function public.snapshot_order_item_cashback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(product.cashback, 0)
  into new.unit_cashback
  from public.products product
  where product.tenant_id = new.tenant_id
    and product.id = new.product_id;

  new.unit_cashback := coalesce(new.unit_cashback, 0);
  return new;
end;
$$;

drop trigger if exists snapshot_order_item_cashback on public.order_items;
create trigger snapshot_order_item_cashback
before insert on public.order_items
for each row execute function public.snapshot_order_item_cashback();

create or replace function public.refresh_order_cashback_total()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text;
  v_tenant_id uuid;
begin
  if tg_op = 'DELETE' then
    v_order_id := old.order_id;
    v_tenant_id := old.tenant_id;
  else
    v_order_id := new.order_id;
    v_tenant_id := new.tenant_id;
  end if;

  update public.orders target
  set cashback_total = coalesce((
    select sum(item.quantity * item.unit_cashback)
    from public.order_items item
    where item.tenant_id = v_tenant_id and item.order_id = v_order_id
  ), 0)
  where target.tenant_id = v_tenant_id and target.id = v_order_id;

  return null;
end;
$$;

drop trigger if exists refresh_order_cashback_total on public.order_items;
create trigger refresh_order_cashback_total
after insert or update or delete on public.order_items
for each row execute function public.refresh_order_cashback_total();

-- Catálogo público com allowlist; cashback é informação promocional pública.
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
  product.badge,
  product.accent,
  product.description,
  product.rating,
  product.reviews,
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
