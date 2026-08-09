begin;

-- A vitrine precisa conhecer apenas uma faixa de disponibilidade. O estoque
-- exato e as reservas continuam inacessíveis aos visitantes.
create or replace function public.storefront_product_availability(
  p_tenant_id uuid,
  p_product_id text
)
returns table (
  availability text,
  purchase_limit integer
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with available_stock as (
    select greatest(
      0,
      product.stock - coalesce(sum(reservation.quantity) filter (
        where reservation.status = 'active'
          and reservation.expires_at > now()
      ), 0)
    )::integer as quantity
    from public.products product
    join public.tenants tenant
      on tenant.id = product.tenant_id
     and tenant.status in ('trial', 'active')
    left join public.order_stock_reservations reservation
      on reservation.tenant_id = product.tenant_id
     and reservation.product_id = product.id
    where product.tenant_id = p_tenant_id
      and product.id = p_product_id
      and product.active = true
    group by product.stock
  )
  select
    case
      when quantity <= 0 then 'out_of_stock'
      when quantity <= 5 then 'low_stock'
      else 'in_stock'
    end,
    least(10, quantity)
  from available_stock;
$$;

revoke all on function public.storefront_product_availability(uuid, text)
  from public, anon, authenticated;
grant execute on function public.storefront_product_availability(uuid, text)
  to anon, authenticated;

-- Visitantes passam pela RLS da tabela base e recebem privilégio somente nas
-- colunas que já fazem parte do contrato público da vitrine.
drop policy if exists "public tenant products" on public.products;
drop policy if exists "public active products" on public.products;
drop policy if exists "public storefront products" on public.products;
create policy "public storefront products" on public.products
for select to anon
using (active = true and public.is_public_tenant(tenant_id));

revoke all on table public.products from anon;
grant select (
  tenant_id,
  id,
  slug,
  name,
  category_id,
  brand,
  price,
  compare_at,
  cashback,
  cashback_type,
  badge,
  accent,
  description,
  featured,
  active,
  order_index,
  image_url,
  image_urls,
  product_type,
  regulatory_status,
  active_ingredient,
  anvisa_registration,
  presentation,
  regulatory_warning,
  pharmacist_reviewed
) on table public.products to anon;

drop view if exists public.storefront_products;
create view public.storefront_products
with (security_barrier = true, security_invoker = true)
as
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
  stock_status.availability,
  stock_status.purchase_limit
from public.products product
cross join lateral public.storefront_product_availability(
  product.tenant_id,
  product.id
) stock_status
where product.active = true
  and public.is_public_tenant(product.tenant_id);

revoke all on table public.storefront_products from public, anon, authenticated;
grant select on table public.storefront_products to anon, authenticated;

-- Buckets públicos já entregam arquivos pelo endereço público. As políticas
-- SELECT antigas permitiam também listar todos os objetos do bucket.
drop policy if exists "public media read" on storage.objects;
drop policy if exists "public site media read" on storage.objects;

-- Evita que um search_path controlável altere a resolução dos utilitários
-- usados pelas políticas de upload.
alter function public.storage_tenant_id(text) set search_path = pg_catalog;

-- Funções de trigger nunca devem ser chamadas diretamente pelo cliente. Os
-- gatilhos continuam funcionando mesmo sem EXECUTE para os papéis da API.
do $$
declare
  function_row record;
begin
  for function_row in
    select procedure.oid::regprocedure as signature
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prorettype = 'pg_catalog.trigger'::regtype
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      function_row.signature
    );
  end loop;
end;
$$;

-- Helper interno do checkout: somente o backend autoritativo pode chamá-lo.
revoke all on function public.coupon_applicable_subtotal(uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.coupon_applicable_subtotal(uuid, text, jsonb)
  to service_role;

-- Presença e travas colaborativas são RPCs administrativas, nunca públicas.
revoke execute on function public.heartbeat_team_presence(uuid, text, text, text, text, text)
  from public, anon;
revoke execute on function public.acquire_entity_edit_lock(uuid, text, text, text, text, text)
  from public, anon;
revoke execute on function public.release_entity_edit_lock(uuid, text, text)
  from public, anon;
grant execute on function public.heartbeat_team_presence(uuid, text, text, text, text, text)
  to authenticated;
grant execute on function public.acquire_entity_edit_lock(uuid, text, text, text, text, text)
  to authenticated;
grant execute on function public.release_entity_edit_lock(uuid, text, text)
  to authenticated;

-- O agendador público agora é executado pelo backend com service role.
revoke all on function public.process_public_marketing_schedule(uuid)
  from public, anon, authenticated;
grant execute on function public.process_public_marketing_schedule(uuid)
  to service_role;

notify pgrst, 'reload schema';

commit;
