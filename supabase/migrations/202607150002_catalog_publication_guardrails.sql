-- Mantém todos os produtos cadastrados no painel e controla separadamente
-- quais itens podem aparecer e ser pedidos na vitrine pública.
alter table public.products
  add column if not exists product_type text not null default 'unclassified',
  add column if not exists regulatory_status text not null default 'pending',
  add column if not exists active_ingredient text not null default '',
  add column if not exists anvisa_registration text not null default '',
  add column if not exists presentation text not null default '',
  add column if not exists regulatory_warning text not null default '',
  add column if not exists pharmacist_reviewed boolean not null default false;

alter table public.banners
  add column if not exists mobile_image_url text not null default '',
  add column if not exists alt_text text not null default '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'products_product_type_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_product_type_check
      check (product_type in ('unclassified', 'non_medicine', 'otc', 'prescription', 'controlled'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_regulatory_status_check'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint products_regulatory_status_check
      check (regulatory_status in ('pending', 'approved', 'blocked'));
  end if;
end $$;

insert into public.categories (tenant_id, id, name, slug, active, order_index)
values (
  '00000000-0000-4000-8000-000000000100',
  'cat-7',
  'Acessórios de cuidado',
  'acessorios-de-cuidado',
  true,
  7
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  active = excluded.active,
  order_index = excluded.order_index;

-- Item não medicamentoso com imagem real para manter a vitrine funcional.
insert into public.products (
  tenant_id, id, slug, name, category_id, brand, price, compare_at, stock,
  badge, accent, description, sku, rating, reviews, featured, active,
  order_index, image_url, image_urls, product_type, regulatory_status,
  presentation, pharmacist_reviewed
)
values (
  '00000000-0000-4000-8000-000000000100',
  'garrafa-termica-650ml',
  'garrafa-termica-650ml',
  'Garrafa térmica 650 ml',
  'cat-7',
  'Junior Imports',
  89.90,
  99.90,
  34,
  '',
  '#25385e',
  'Garrafa térmica em aço inoxidável com acabamento fosco, tampa segura e alça para transporte.',
  'JI-A04',
  0,
  0,
  true,
  true,
  104,
  '/demo-products/garrafa-termica-650ml.png',
  '["/demo-products/garrafa-termica-650ml.png"]'::jsonb,
  'non_medicine',
  'approved',
  '1 garrafa térmica de 650 ml',
  true
)
on conflict (id) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  slug = excluded.slug,
  brand = excluded.brand,
  price = excluded.price,
  compare_at = excluded.compare_at,
  stock = excluded.stock,
  description = excluded.description,
  sku = excluded.sku,
  featured = excluded.featured,
  active = excluded.active,
  image_url = excluded.image_url,
  image_urls = excluded.image_urls,
  product_type = excluded.product_type,
  regulatory_status = excluded.regulatory_status,
  presentation = excluded.presentation,
  pharmacist_reviewed = excluded.pharmacist_reviewed;

drop policy if exists "public active products" on public.products;
drop policy if exists "public tenant products" on public.products;
create policy "public tenant products" on public.products for select to anon, authenticated
using (
  (
    active
    and regulatory_status = 'approved'
    and product_type in ('non_medicine', 'otc')
    and public.is_public_tenant(tenant_id)
  )
  or public.has_tenant_permission(tenant_id, 'catalog')
);

create or replace function public.enforce_sellable_order_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  product_row public.products%rowtype;
begin
  select * into product_row
  from public.products
  where id = new.product_id and tenant_id = new.tenant_id;

  if not found
    or not product_row.active
    or product_row.regulatory_status <> 'approved'
    or product_row.product_type not in ('non_medicine', 'otc')
    or (
      product_row.product_type = 'otc'
      and (
        product_row.active_ingredient = ''
        or product_row.presentation = ''
        or product_row.anvisa_registration = ''
        or product_row.regulatory_warning = ''
        or not product_row.pharmacist_reviewed
      )
    )
  then
    raise exception 'Produto indisponível para pedido público';
  end if;

  return new;
end;
$$;

drop trigger if exists order_items_sellable_product on public.order_items;
create trigger order_items_sellable_product
before insert or update of product_id, tenant_id on public.order_items
for each row execute function public.enforce_sellable_order_item();
