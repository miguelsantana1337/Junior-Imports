-- CRM, recorrência, limites de cupom, campanha central de frete e histórico de importações.

alter table public.store_settings
  add column if not exists free_shipping_enabled boolean not null default true,
  add column if not exists free_shipping_banner_enabled boolean not null default true,
  add column if not exists free_shipping_banner_eyebrow text not null default 'CONDIÇÃO ESPECIAL',
  add column if not exists free_shipping_banner_title text not null default 'Frete grátis acima de {{valor}}.',
  add column if not exists free_shipping_banner_subtitle text not null default 'Aproveite a condição e envie seu pedido em poucos passos.',
  add column if not exists free_shipping_banner_button_text text not null default 'Ver produtos',
  add column if not exists free_shipping_banner_button_link text not null default '#catalogo';

update public.store_settings
set announcement = regexp_replace(announcement, 'R[$][[:space:]]*[0-9.,]+', '{{valor}}', 'i')
where announcement ilike '%frete gr%tis%acima de%'
  and announcement not like '%{{valor}}%';

alter table public.coupons
  add column if not exists starts_at date,
  add column if not exists total_usage_limit integer not null default 0,
  add column if not exists per_customer_limit integer not null default 1,
  add column if not exists first_order_only boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coupons_total_usage_limit_check' and conrelid = 'public.coupons'::regclass) then
    alter table public.coupons add constraint coupons_total_usage_limit_check check (total_usage_limit >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'coupons_per_customer_limit_check' and conrelid = 'public.coupons'::regclass) then
    alter table public.coupons add constraint coupons_per_customer_limit_check check (per_customer_limit >= 0);
  end if;
end $$;

create or replace function public.normalize_customer_phone(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(digits) in (10, 11) then '55' || digits
    else digits
  end
  from (select regexp_replace(coalesce(p_value, ''), '[^0-9]', '', 'g') as digits) normalized;
$$;

create table if not exists public.customers (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  name text not null,
  email text not null default '',
  phone text not null default '',
  normalized_email text not null default '',
  normalized_phone text not null default '',
  city text not null default '',
  state text not null default '',
  source text not null default 'other' check (source in ('whatsapp', 'instagram', 'referral', 'other')),
  tags text[] not null default '{}',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_tenant_email on public.customers (tenant_id, normalized_email) where normalized_email <> '';
create index if not exists customers_tenant_phone on public.customers (tenant_id, normalized_phone) where normalized_phone <> '';
create index if not exists customers_tenant_updated on public.customers (tenant_id, updated_at desc);

alter table public.orders
  add column if not exists customer_id text references public.customers(id) on delete set null,
  add column if not exists internal_notes text not null default '',
  add column if not exists tracking_code text not null default '';

create table if not exists public.coupon_redemptions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  coupon_id text not null references public.coupons(id) on delete cascade,
  coupon_code text not null,
  customer_id text references public.customers(id) on delete set null,
  order_id text not null references public.orders(id) on delete cascade,
  normalized_email text not null default '',
  normalized_phone text not null default '',
  discount numeric(12,2) not null default 0,
  status text not null default 'used' check (status in ('used', 'released')),
  used_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create index if not exists coupon_redemptions_coupon_status on public.coupon_redemptions (tenant_id, coupon_id, status);
create index if not exists coupon_redemptions_email on public.coupon_redemptions (tenant_id, normalized_email) where normalized_email <> '';
create index if not exists coupon_redemptions_phone on public.coupon_redemptions (tenant_id, normalized_phone) where normalized_phone <> '';

create table if not exists public.catalog_imports (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  kind text not null check (kind in ('products', 'stock')),
  filename text not null,
  mode text not null check (mode in ('upsert', 'replace', 'increment', 'decrement')),
  total_rows integer not null default 0 check (total_rows >= 0),
  success_rows integer not null default 0 check (success_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists catalog_imports_tenant_created on public.catalog_imports (tenant_id, created_at desc);

-- Converte os clientes já existentes nos pedidos em registros do CRM.
with order_customers as (
  select distinct on (
    tenant_id,
    coalesce(nullif(lower(trim(customer->>'email')), ''), 'phone:' || public.normalize_customer_phone(customer->>'phone'))
  )
    tenant_id,
    gen_random_uuid()::text as id,
    coalesce(nullif(trim(customer->>'name'), ''), 'Cliente') as name,
    coalesce(customer->>'email', '') as email,
    coalesce(customer->>'phone', '') as phone,
    lower(trim(coalesce(customer->>'email', ''))) as normalized_email,
    public.normalize_customer_phone(customer->>'phone') as normalized_phone,
    coalesce(customer->>'city', '') as city,
    coalesce(customer->>'state', '') as state,
    min(created_at) over (partition by tenant_id, coalesce(nullif(lower(trim(customer->>'email')), ''), 'phone:' || public.normalize_customer_phone(customer->>'phone'))) as first_seen,
    max(created_at) over (partition by tenant_id, coalesce(nullif(lower(trim(customer->>'email')), ''), 'phone:' || public.normalize_customer_phone(customer->>'phone'))) as last_seen
  from public.orders
  where coalesce(nullif(lower(trim(customer->>'email')), ''), public.normalize_customer_phone(customer->>'phone')) <> ''
  order by tenant_id, coalesce(nullif(lower(trim(customer->>'email')), ''), 'phone:' || public.normalize_customer_phone(customer->>'phone')), created_at desc
)
insert into public.customers (tenant_id, id, name, email, phone, normalized_email, normalized_phone, city, state, created_at, updated_at)
select tenant_id, id, name, email, phone, normalized_email, normalized_phone, city, state, coalesce(first_seen, now()), coalesce(last_seen, now())
from order_customers source
where not exists (
  select 1 from public.customers customer
  where customer.tenant_id = source.tenant_id
    and ((source.normalized_email <> '' and customer.normalized_email = source.normalized_email)
      or (source.normalized_phone <> '' and customer.normalized_phone = source.normalized_phone))
);

update public.orders order_row
set customer_id = customer.id
from public.customers customer
where order_row.customer_id is null
  and order_row.tenant_id = customer.tenant_id
  and (
    (customer.normalized_email <> '' and customer.normalized_email = lower(trim(coalesce(order_row.customer->>'email', ''))))
    or (customer.normalized_phone <> '' and customer.normalized_phone = public.normalize_customer_phone(order_row.customer->>'phone'))
  );

insert into public.coupon_redemptions (tenant_id, coupon_id, coupon_code, customer_id, order_id, normalized_email, normalized_phone, discount, status, used_at)
select orders.tenant_id, coupons.id, coupons.code, orders.customer_id, orders.id,
  lower(trim(coalesce(orders.customer->>'email', ''))),
  public.normalize_customer_phone(orders.customer->>'phone'),
  orders.discount,
  case when orders.status = 'Cancelado' then 'released' else 'used' end,
  orders.created_at
from public.orders orders
join public.coupons coupons on coupons.tenant_id = orders.tenant_id and upper(coupons.code) = upper(orders.coupon_code)
where orders.coupon_code <> ''
on conflict (order_id) do nothing;

alter table public.customers enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.catalog_imports enable row level security;

drop policy if exists "tenant customers manage" on public.customers;
create policy "tenant customers manage" on public.customers for all to authenticated
using (public.has_tenant_permission(tenant_id, 'customers'))
with check (public.has_tenant_permission(tenant_id, 'customers'));

drop policy if exists "tenant coupon redemptions read" on public.coupon_redemptions;
create policy "tenant coupon redemptions read" on public.coupon_redemptions for select to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing') or public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'orders'));

drop policy if exists "tenant catalog imports manage" on public.catalog_imports;
create policy "tenant catalog imports manage" on public.catalog_imports for all to authenticated
using (public.has_tenant_permission(tenant_id, 'catalog'))
with check (public.has_tenant_permission(tenant_id, 'catalog'));

alter table public.profiles drop constraint if exists profiles_permissions_check;
alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array['dashboard', 'customers', 'orders', 'catalog', 'store', 'marketing', 'settings', 'data', 'users']::text[]
);
alter table public.tenant_members drop constraint if exists tenant_members_permissions_check;
alter table public.tenant_members add constraint tenant_members_permissions_check check (
  permissions <@ array['dashboard', 'customers', 'orders', 'catalog', 'store', 'marketing', 'settings', 'data', 'users']::text[]
);

update public.profiles set permissions = array_append(permissions, 'customers')
where active = true and role in ('admin', 'manager', 'support') and not ('customers' = any(permissions));
update public.tenant_members set permissions = array_append(permissions, 'customers')
where active = true and role in ('owner', 'manager', 'support') and not ('customers' = any(permissions));

drop trigger if exists admin_audit_change on public.customers;
create trigger admin_audit_change after insert or update or delete on public.customers
for each row execute function public.capture_admin_audit();
drop trigger if exists admin_audit_change on public.catalog_imports;
create trigger admin_audit_change after insert or update or delete on public.catalog_imports
for each row execute function public.capture_admin_audit();

create or replace function public.create_tenant_order(
  p_tenant_id uuid,
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
  v_customer_id text;
  v_code text;
  v_email text := lower(trim(coalesce(p_customer->>'email', '')));
  v_phone text := public.normalize_customer_phone(p_customer->>'phone');
  v_subtotal numeric(12,2) := 0;
  v_coupon_discount numeric(12,2) := 0;
  v_payment_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_total_usage integer := 0;
  v_customer_usage integer := 0;
  v_previous_orders integer := 0;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
begin
  if not public.is_public_tenant(p_tenant_id) then raise exception 'Loja indisponível'; end if;
  if p_payment not in ('Pix', 'Cartao', 'Boleto') then raise exception 'Método de pagamento inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Carrinho excede o limite de itens'; end if;
  if length(trim(coalesce(p_customer->>'name', ''))) < 3 then raise exception 'Nome do cliente inválido'; end if;
  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'E-mail do cliente inválido'; end if;
  if length(v_phone) not between 12 and 13 then raise exception 'Telefone do cliente inválido'; end if;

  select id into v_customer_id from public.customers
  where tenant_id = p_tenant_id
    and ((normalized_email <> '' and normalized_email = v_email) or (normalized_phone <> '' and normalized_phone = v_phone))
  order by updated_at desc limit 1;

  if v_customer_id is null then
    v_customer_id := gen_random_uuid()::text;
    insert into public.customers (tenant_id, id, name, email, phone, normalized_email, normalized_phone, city, state, source)
    values (p_tenant_id, v_customer_id, trim(p_customer->>'name'), p_customer->>'email', p_customer->>'phone', v_email, v_phone, coalesce(p_customer->>'city', ''), coalesce(p_customer->>'state', ''), 'whatsapp');
  else
    update public.customers set
      name = trim(p_customer->>'name'), email = p_customer->>'email', phone = p_customer->>'phone',
      normalized_email = v_email, normalized_phone = v_phone,
      city = coalesce(p_customer->>'city', city), state = coalesce(p_customer->>'state', state), updated_at = now()
    where tenant_id = p_tenant_id and id = v_customer_id;
  end if;

  select count(*) into v_previous_orders from public.orders
  where tenant_id = p_tenant_id and customer_id = v_customer_id and status <> 'Cancelado';

  select * into v_settings from public.store_settings where tenant_id = p_tenant_id and id = 'default';
  if not found then raise exception 'Configuração da loja não encontrada'; end if;
  v_code := v_settings.order_prefix || '-' || nextval('public.order_code_seq');

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 100 then raise exception 'Quantidade inválida'; end if;
    select * into v_product from public.products where tenant_id = p_tenant_id and id = v_item->>'product_id' and active = true;
    if not found or v_product.stock < v_quantity then raise exception 'Produto indisponível'; end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if coalesce(trim(p_coupon_code), '') <> '' then
    select * into v_coupon from public.coupons
    where tenant_id = p_tenant_id and upper(code) = upper(trim(p_coupon_code))
    for update;
    if not found or not v_coupon.active then raise exception 'Cupom inválido ou inativo'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > current_date then raise exception 'Este cupom ainda não está disponível'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < current_date then raise exception 'Este cupom expirou'; end if;
    if v_coupon.minimum > v_subtotal then raise exception 'O pedido não atingiu o valor mínimo deste cupom'; end if;
    select count(*) into v_total_usage from public.coupon_redemptions where tenant_id = p_tenant_id and coupon_id = v_coupon.id and status = 'used';
    if v_coupon.total_usage_limit > 0 and v_total_usage >= v_coupon.total_usage_limit then raise exception 'O limite total de utilizações deste cupom foi atingido'; end if;
    select count(*) into v_customer_usage from public.coupon_redemptions
    where tenant_id = p_tenant_id and coupon_id = v_coupon.id and status = 'used'
      and ((normalized_email <> '' and normalized_email = v_email) or (normalized_phone <> '' and normalized_phone = v_phone));
    if v_coupon.per_customer_limit > 0 and v_customer_usage >= v_coupon.per_customer_limit then raise exception 'Este cupom já atingiu o limite de uso para este cliente'; end if;
    if v_coupon.first_order_only and v_previous_orders > 0 then raise exception 'Este cupom é válido somente para a primeira compra'; end if;
    v_coupon_discount := case when v_coupon.discount_type = 'percent' then v_subtotal * v_coupon.value / 100 else v_coupon.value end;
    v_coupon_discount := least(v_coupon_discount, v_subtotal);
  end if;

  if p_payment = 'Pix' then v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100; end if;
  v_total := greatest(0, v_subtotal - v_coupon_discount - v_payment_discount);
  if not v_settings.free_shipping_enabled or v_total < v_settings.free_shipping_threshold then v_shipping := v_settings.shipping_flat; end if;
  v_total := v_total + v_shipping;

  insert into public.orders (tenant_id, id, customer_id, code, customer, subtotal, discount, shipping, total, payment, status, coupon_code)
  values (p_tenant_id, v_order_id, v_customer_id, v_code, p_customer, v_subtotal, v_coupon_discount + v_payment_discount, v_shipping, v_total, p_payment, 'Novo', case when v_coupon.id is null then '' else v_coupon.code end);

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where tenant_id = p_tenant_id and id = v_item->>'product_id';
    insert into public.order_items (tenant_id, order_id, product_id, product_name, quantity, unit_price)
    values (p_tenant_id, v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);
  end loop;

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (tenant_id, coupon_id, coupon_code, customer_id, order_id, normalized_email, normalized_phone, discount, status)
    values (p_tenant_id, v_coupon.id, v_coupon.code, v_customer_id, v_order_id, v_email, v_phone, v_coupon_discount, 'used');
  end if;

  return jsonb_build_object('id', v_order_id, 'customer_id', v_customer_id, 'code', v_code, 'subtotal', v_subtotal, 'discount', v_coupon_discount + v_payment_discount, 'shipping', v_shipping, 'total', v_total, 'status', 'Novo', 'created_at', now());
end;
$$;

grant execute on function public.create_tenant_order(uuid, jsonb, jsonb, text, text) to anon, authenticated;

create or replace function public.update_tenant_order_status(p_tenant_id uuid, p_order_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then raise exception 'Acesso negado'; end if;
  if p_status not in ('Novo', 'Aguardando pagamento', 'Pago', 'Preparando', 'Enviado', 'Entregue', 'Cancelado') then raise exception 'Status inválido'; end if;
  update public.orders set status = p_status where tenant_id = p_tenant_id and id = p_order_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
  update public.coupon_redemptions set status = case when p_status = 'Cancelado' then 'released' else 'used' end, updated_at = now()
  where tenant_id = p_tenant_id and order_id = p_order_id;
end;
$$;

grant execute on function public.update_tenant_order_status(uuid, text, text) to authenticated;
