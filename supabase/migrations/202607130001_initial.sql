create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.store_settings (
  id text primary key default 'default',
  store_name text not null,
  whatsapp text not null,
  email text not null,
  hours text not null,
  announcement text not null,
  footer_description text not null,
  primary_color text not null default '#1677ff',
  free_shipping_threshold numeric(12,2) not null default 499,
  shipping_flat numeric(12,2) not null default 29.90,
  pix_discount numeric(5,2) not null default 5,
  auto_banner_seconds integer not null default 6 check (auto_banner_seconds between 3 and 30),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  name text not null unique,
  slug text not null unique,
  active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  slug text not null unique,
  name text not null,
  category_id text not null references public.categories(id) on update cascade,
  brand text not null default '',
  price numeric(12,2) not null check (price >= 0),
  compare_at numeric(12,2) not null default 0 check (compare_at >= 0),
  stock integer not null default 0 check (stock >= 0),
  badge text not null default '',
  accent text not null default '#1677ff',
  description text not null default '',
  sku text not null unique,
  rating numeric(2,1) not null default 5 check (rating between 0 and 5),
  reviews integer not null default 0 check (reviews >= 0),
  featured boolean not null default false,
  active boolean not null default true,
  order_index integer not null default 0,
  image_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.banners (
  id text primary key,
  kicker text not null default '',
  title text not null,
  highlight text not null default '',
  subtitle text not null default '',
  button_text text not null default 'Ver produtos',
  button_link text not null default '#catalogo',
  start_color text not null default '#07101f',
  end_color text not null default '#1677ff',
  image_url text not null default '',
  active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.home_sections (
  id text primary key,
  kind text not null unique check (kind in ('featured', 'catalog', 'promo', 'benefits', 'faq')),
  name text not null,
  eyebrow text not null default '',
  title text not null default '',
  subtitle text not null default '',
  button_text text not null default '',
  button_link text not null default '',
  active boolean not null default true,
  order_index integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id text primary key,
  code text not null unique,
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  value numeric(12,2) not null check (value >= 0),
  minimum numeric(12,2) not null default 0 check (minimum >= 0),
  active boolean not null default true,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trust_items (
  id text primary key,
  title text not null,
  subtitle text not null default '',
  order_index integer not null default 0
);

create table if not exists public.benefits (
  id text primary key,
  title text not null,
  text text not null default '',
  order_index integer not null default 0
);

create table if not exists public.faqs (
  id text primary key,
  question text not null,
  answer text not null,
  order_index integer not null default 0
);

create sequence if not exists public.order_code_seq start 1004;

create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  code text not null unique default ('JI-' || nextval('public.order_code_seq')),
  created_at timestamptz not null default now(),
  customer jsonb not null,
  subtotal numeric(12,2) not null,
  discount numeric(12,2) not null default 0,
  shipping numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  payment text not null check (payment in ('Pix', 'Cartao', 'Boleto')),
  status text not null default 'Novo' check (status in ('Novo', 'Aguardando pagamento', 'Pago', 'Preparando', 'Enviado', 'Entregue', 'Cancelado')),
  coupon_code text not null default ''
);

create table if not exists public.order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text references public.products(id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'viewer') on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.create_demo_order(
  p_customer jsonb,
  p_items jsonb,
  p_payment text,
  p_coupon_code text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id text := gen_random_uuid()::text;
  v_code text := 'JI-' || nextval('public.order_code_seq');
  v_subtotal numeric(12,2) := 0;
  v_coupon_discount numeric(12,2) := 0;
  v_payment_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
begin
  if p_payment not in ('Pix', 'Cartao', 'Boleto') then raise exception 'Metodo de pagamento invalido'; end if;
  if jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;
  select * into v_settings from public.store_settings where id = 'default';
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := greatest(1, (v_item->>'quantity')::integer);
    select * into v_product from public.products where id = v_item->>'product_id' and active = true;
    if not found or v_product.stock < v_quantity then raise exception 'Produto indisponivel'; end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;
  if coalesce(p_coupon_code, '') <> '' then
    select * into v_coupon from public.coupons where upper(code) = upper(p_coupon_code) and active = true and (expires_at is null or expires_at >= current_date) and minimum <= v_subtotal;
    if found then
      v_coupon_discount := case when v_coupon.discount_type = 'percent' then v_subtotal * v_coupon.value / 100 else v_coupon.value end;
      v_coupon_discount := least(v_coupon_discount, v_subtotal);
    end if;
  end if;
  if p_payment = 'Pix' then v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100; end if;
  v_total := greatest(0, v_subtotal - v_coupon_discount - v_payment_discount);
  if v_total < v_settings.free_shipping_threshold then v_shipping := v_settings.shipping_flat; end if;
  v_total := v_total + v_shipping;
  insert into public.orders (id, code, customer, subtotal, discount, shipping, total, payment, status, coupon_code)
  values (v_order_id, v_code, p_customer, v_subtotal, v_coupon_discount + v_payment_discount, v_shipping, v_total, p_payment, 'Novo', coalesce(p_coupon_code, ''));
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := greatest(1, (v_item->>'quantity')::integer);
    select * into v_product from public.products where id = v_item->>'product_id';
    insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
    values (v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);
  end loop;
  return jsonb_build_object('id', v_order_id, 'code', v_code, 'subtotal', v_subtotal, 'discount', v_coupon_discount + v_payment_discount, 'shipping', v_shipping, 'total', v_total, 'status', 'Novo', 'created_at', now());
end;
$$;

grant execute on function public.create_demo_order(jsonb, jsonb, text, text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.banners enable row level security;
alter table public.home_sections enable row level security;
alter table public.coupons enable row level security;
alter table public.trust_items enable row level security;
alter table public.benefits enable row level security;
alter table public.faqs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles own read" on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "admin profiles" on public.profiles for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public settings" on public.store_settings for select to anon, authenticated using (true);
create policy "public active categories" on public.categories for select to anon, authenticated using (active or public.is_admin());
create policy "public active products" on public.products for select to anon, authenticated using (active or public.is_admin());
create policy "public active banners" on public.banners for select to anon, authenticated using (active or public.is_admin());
create policy "public active sections" on public.home_sections for select to anon, authenticated using (active or public.is_admin());
create policy "public active coupons" on public.coupons for select to anon, authenticated using (active or public.is_admin());
create policy "public trust items" on public.trust_items for select to anon, authenticated using (true);
create policy "public benefits" on public.benefits for select to anon, authenticated using (true);
create policy "public faqs" on public.faqs for select to anon, authenticated using (true);
create policy "admin orders" on public.orders for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin order items" on public.order_items for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "admin settings" on public.store_settings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin categories" on public.categories for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin products" on public.products for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin banners" on public.banners for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin sections" on public.home_sections for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin coupons" on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin trust items" on public.trust_items for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin benefits" on public.benefits for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin faqs" on public.faqs for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public) values ('product-media', 'product-media', true), ('banner-media', 'banner-media', true) on conflict (id) do update set public = excluded.public;
create policy "public media read" on storage.objects for select to anon, authenticated using (bucket_id in ('product-media', 'banner-media'));
create policy "admin media insert" on storage.objects for insert to authenticated with check (bucket_id in ('product-media', 'banner-media') and public.is_admin());
create policy "admin media update" on storage.objects for update to authenticated using (bucket_id in ('product-media', 'banner-media') and public.is_admin()) with check (bucket_id in ('product-media', 'banner-media') and public.is_admin());
create policy "admin media delete" on storage.objects for delete to authenticated using (bucket_id in ('product-media', 'banner-media') and public.is_admin());
