begin;

-- O limite público deve acompanhar o saldo realmente disponível para que o
-- carrinho permita mais de uma unidade, mantendo o teto de dez por pedido.
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
  least(10, availability.available_quantity) as purchase_limit
from public.products product
join public.tenants tenant on tenant.id = product.tenant_id
join availability on availability.tenant_id = product.tenant_id and availability.id = product.id
where product.active = true
  and tenant.status in ('trial', 'active');

revoke all on table public.storefront_products from public, anon, authenticated;
grant select on table public.storefront_products to anon, authenticated;

commit;
