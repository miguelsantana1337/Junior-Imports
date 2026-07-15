-- Fundação SaaS multi-tenant. A loja existente vira o primeiro tenant.
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  plan text not null default 'starter' check (plan in ('starter', 'pro', 'scale')),
  primary_domain text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'viewer' check (role in ('owner', 'manager', 'editor', 'support', 'viewer')),
  permissions text[] not null default array['dashboard']::text[],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  constraint tenant_members_permissions_check check (
    permissions <@ array['dashboard', 'orders', 'catalog', 'store', 'marketing', 'settings', 'data', 'users']::text[]
  )
);

create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  hostname text not null unique,
  verified boolean not null default false,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists is_platform_admin boolean not null default false;
update public.profiles set is_platform_admin = true where role = 'owner';

insert into public.tenants (id, slug, name, status, plan)
values ('00000000-0000-4000-8000-000000000100', 'junior-imports', 'Junior Imports', 'active', 'pro')
on conflict (id) do update set name = excluded.name;

alter table public.store_settings
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade default '00000000-0000-4000-8000-000000000100',
  add column if not exists order_prefix text not null default 'JI' check (order_prefix ~ '^[A-Z0-9]{2,5}$'),
  add column if not exists checkout_mode text not null default 'whatsapp' check (checkout_mode in ('whatsapp', 'demo')),
  add column if not exists whatsapp_message text not null default 'Olá! Quero finalizar o pedido {{pedido}} da {{loja}}.\n\n{{itens}}\n\nTotal: {{total}}\nCliente: {{cliente}}';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'categories', 'products', 'banners', 'home_sections', 'coupons',
    'trust_items', 'benefits', 'faqs', 'orders', 'order_items',
    'store_pages', 'page_blocks', 'message_automations', 'message_logs', 'audit_logs'
  ] loop
    execute format(
      'alter table public.%I add column if not exists tenant_id uuid references public.tenants(id) on delete cascade default %L',
      table_name,
      '00000000-0000-4000-8000-000000000100'
    );
  end loop;
end;
$$;

alter table public.store_settings alter column tenant_id set not null;
alter table public.categories alter column tenant_id set not null;
alter table public.products alter column tenant_id set not null;
alter table public.banners alter column tenant_id set not null;
alter table public.home_sections alter column tenant_id set not null;
alter table public.coupons alter column tenant_id set not null;
alter table public.trust_items alter column tenant_id set not null;
alter table public.benefits alter column tenant_id set not null;
alter table public.faqs alter column tenant_id set not null;
alter table public.orders alter column tenant_id set not null;
alter table public.order_items alter column tenant_id set not null;
alter table public.store_pages alter column tenant_id set not null;
alter table public.page_blocks alter column tenant_id set not null;
alter table public.message_automations alter column tenant_id set not null;
alter table public.message_logs alter column tenant_id set not null;
alter table public.audit_logs alter column tenant_id set not null;

insert into public.tenant_members (tenant_id, user_id, role, permissions, active)
select '00000000-0000-4000-8000-000000000100', id, role, permissions, active
from public.profiles
on conflict (tenant_id, user_id) do update set
  role = excluded.role,
  permissions = excluded.permissions,
  active = excluded.active;

alter table public.store_settings drop constraint if exists store_settings_pkey;
alter table public.store_settings add primary key (tenant_id, id);

alter table public.categories drop constraint if exists categories_name_key;
alter table public.categories drop constraint if exists categories_slug_key;
alter table public.categories add constraint categories_tenant_name_key unique (tenant_id, name);
alter table public.categories add constraint categories_tenant_slug_key unique (tenant_id, slug);

alter table public.products drop constraint if exists products_slug_key;
alter table public.products drop constraint if exists products_sku_key;
alter table public.products add constraint products_tenant_slug_key unique (tenant_id, slug);
alter table public.products add constraint products_tenant_sku_key unique (tenant_id, sku);

alter table public.home_sections drop constraint if exists home_sections_kind_key;
alter table public.home_sections add constraint home_sections_tenant_kind_key unique (tenant_id, kind);

alter table public.coupons drop constraint if exists coupons_code_key;
alter table public.coupons add constraint coupons_tenant_code_key unique (tenant_id, code);

alter table public.orders drop constraint if exists orders_code_key;
alter table public.orders add constraint orders_tenant_code_key unique (tenant_id, code);

alter table public.store_pages drop constraint if exists store_pages_slug_key;
alter table public.store_pages add constraint store_pages_tenant_slug_key unique (tenant_id, slug);
drop index if exists public.store_pages_single_home;
create unique index store_pages_single_home on public.store_pages (tenant_id) where is_home = true;

create index if not exists tenant_members_user on public.tenant_members (user_id, active);
create index if not exists tenant_domains_tenant on public.tenant_domains (tenant_id);
create unique index if not exists tenant_domains_single_primary on public.tenant_domains (tenant_id) where is_primary = true;
create index if not exists products_tenant_order on public.products (tenant_id, order_index);
create index if not exists orders_tenant_created on public.orders (tenant_id, created_at desc);
create index if not exists pages_tenant_order on public.store_pages (tenant_id, order_index);
create index if not exists audit_logs_tenant_created on public.audit_logs (tenant_id, created_at desc);

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and active = true and is_platform_admin = true
  );
$$;

create or replace function public.has_tenant_permission(requested_tenant uuid, requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists(
    select 1
    from public.tenant_members
    where tenant_id = requested_tenant
      and user_id = auth.uid()
      and active = true
      and (role = 'owner' or requested_permission = any(permissions))
  );
$$;

create or replace function public.is_public_tenant(requested_tenant uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.tenants
    where id = requested_tenant and status in ('trial', 'active')
  );
$$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_tenant_permission(uuid, text) to authenticated;
grant execute on function public.is_public_tenant(uuid) to anon, authenticated;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_domains enable row level security;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'profiles', 'store_settings', 'categories', 'products', 'banners',
        'home_sections', 'coupons', 'trust_items', 'benefits', 'faqs',
        'orders', 'order_items', 'store_pages', 'page_blocks',
        'message_automations', 'message_logs', 'audit_logs', 'tenants',
        'tenant_members', 'tenant_domains'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

create policy "tenant catalog read" on public.tenants for select to anon, authenticated
using (status in ('trial', 'active') or public.is_platform_admin() or exists (
  select 1 from public.tenant_members where tenant_id = tenants.id and user_id = auth.uid() and active = true
));
create policy "platform tenants manage" on public.tenants for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "tenant memberships read" on public.tenant_members for select to authenticated
using (user_id = auth.uid() or public.has_tenant_permission(tenant_id, 'users'));
create policy "tenant memberships manage" on public.tenant_members for all to authenticated
using (public.has_tenant_permission(tenant_id, 'users')) with check (public.has_tenant_permission(tenant_id, 'users'));

create policy "public verified domains" on public.tenant_domains for select to anon, authenticated
using (verified = true or public.has_tenant_permission(tenant_id, 'settings'));
create policy "tenant domains manage" on public.tenant_domains for all to authenticated
using (public.has_tenant_permission(tenant_id, 'settings')) with check (public.has_tenant_permission(tenant_id, 'settings'));

create policy "profile self read" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_platform_admin());
create policy "platform profiles manage" on public.profiles for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "public tenant settings" on public.store_settings for select to anon, authenticated
using (public.is_public_tenant(tenant_id) or public.has_tenant_permission(tenant_id, 'settings'));
create policy "tenant settings manage" on public.store_settings for all to authenticated
using (public.has_tenant_permission(tenant_id, 'settings')) with check (public.has_tenant_permission(tenant_id, 'settings'));

create policy "public tenant categories" on public.categories for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'catalog'));
create policy "tenant categories manage" on public.categories for all to authenticated
using (public.has_tenant_permission(tenant_id, 'catalog')) with check (public.has_tenant_permission(tenant_id, 'catalog'));
create policy "public tenant products" on public.products for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'catalog'));
create policy "tenant products manage" on public.products for all to authenticated
using (public.has_tenant_permission(tenant_id, 'catalog')) with check (public.has_tenant_permission(tenant_id, 'catalog'));

create policy "public tenant banners" on public.banners for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant banners manage" on public.banners for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));
create policy "public tenant sections" on public.home_sections for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant sections manage" on public.home_sections for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));
create policy "public tenant trust" on public.trust_items for select to anon, authenticated
using (public.is_public_tenant(tenant_id) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant trust manage" on public.trust_items for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));
create policy "public tenant benefits" on public.benefits for select to anon, authenticated
using (public.is_public_tenant(tenant_id) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant benefits manage" on public.benefits for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));
create policy "public tenant faqs" on public.faqs for select to anon, authenticated
using (public.is_public_tenant(tenant_id) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant faqs manage" on public.faqs for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));

create policy "public tenant pages" on public.store_pages for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant pages manage" on public.store_pages for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));
create policy "public tenant page blocks" on public.page_blocks for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'store'));
create policy "tenant page blocks manage" on public.page_blocks for all to authenticated
using (public.has_tenant_permission(tenant_id, 'store')) with check (public.has_tenant_permission(tenant_id, 'store'));

create policy "public tenant coupons" on public.coupons for select to anon, authenticated
using ((active and public.is_public_tenant(tenant_id)) or public.has_tenant_permission(tenant_id, 'marketing'));
create policy "tenant coupons manage" on public.coupons for all to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing')) with check (public.has_tenant_permission(tenant_id, 'marketing'));
create policy "tenant automations manage" on public.message_automations for all to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing')) with check (public.has_tenant_permission(tenant_id, 'marketing'));
create policy "tenant message logs manage" on public.message_logs for all to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing') or public.has_tenant_permission(tenant_id, 'orders'))
with check (public.has_tenant_permission(tenant_id, 'marketing') or public.has_tenant_permission(tenant_id, 'orders'));

create policy "tenant orders manage" on public.orders for all to authenticated
using (public.has_tenant_permission(tenant_id, 'orders')) with check (public.has_tenant_permission(tenant_id, 'orders'));
create policy "tenant order items manage" on public.order_items for all to authenticated
using (public.has_tenant_permission(tenant_id, 'orders')) with check (public.has_tenant_permission(tenant_id, 'orders'));
create policy "tenant audit read" on public.audit_logs for select to authenticated
using (public.has_tenant_permission(tenant_id, 'dashboard'));

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
  v_code text;
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
  if not public.is_public_tenant(p_tenant_id) then raise exception 'Loja indisponível'; end if;
  if p_payment not in ('Pix', 'Cartao', 'Boleto') then raise exception 'Método de pagamento inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Carrinho excede o limite de itens'; end if;
  if length(trim(coalesce(p_customer->>'name', ''))) < 3 then raise exception 'Nome do cliente inválido'; end if;
  if coalesce(p_customer->>'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'E-mail do cliente inválido'; end if;
  if length(regexp_replace(coalesce(p_customer->>'phone', ''), '[^0-9]', '', 'g')) not between 10 and 13 then raise exception 'Telefone do cliente inválido'; end if;
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
  if coalesce(p_coupon_code, '') <> '' then
    select * into v_coupon from public.coupons where tenant_id = p_tenant_id and upper(code) = upper(p_coupon_code) and active = true and (expires_at is null or expires_at >= current_date) and minimum <= v_subtotal;
    if found then
      v_coupon_discount := case when v_coupon.discount_type = 'percent' then v_subtotal * v_coupon.value / 100 else v_coupon.value end;
      v_coupon_discount := least(v_coupon_discount, v_subtotal);
    end if;
  end if;
  if p_payment = 'Pix' then v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100; end if;
  v_total := greatest(0, v_subtotal - v_coupon_discount - v_payment_discount);
  if v_total < v_settings.free_shipping_threshold then v_shipping := v_settings.shipping_flat; end if;
  v_total := v_total + v_shipping;
  insert into public.orders (tenant_id, id, code, customer, subtotal, discount, shipping, total, payment, status, coupon_code)
  values (p_tenant_id, v_order_id, v_code, p_customer, v_subtotal, v_coupon_discount + v_payment_discount, v_shipping, v_total, p_payment, 'Novo', coalesce(p_coupon_code, ''));
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 100 then raise exception 'Quantidade inválida'; end if;
    select * into v_product from public.products where tenant_id = p_tenant_id and id = v_item->>'product_id';
    insert into public.order_items (tenant_id, order_id, product_id, product_name, quantity, unit_price)
    values (p_tenant_id, v_order_id, v_product.id, v_product.name, v_quantity, v_product.price);
  end loop;
  return jsonb_build_object('id', v_order_id, 'code', v_code, 'subtotal', v_subtotal, 'discount', v_coupon_discount + v_payment_discount, 'shipping', v_shipping, 'total', v_total, 'status', 'Novo', 'created_at', now());
end;
$$;

grant execute on function public.create_tenant_order(uuid, jsonb, jsonb, text, text) to anon, authenticated;
revoke execute on function public.create_demo_order(jsonb, jsonb, text, text) from anon, authenticated;

drop function if exists public.reorder_admin_items(text, jsonb);
create or replace function public.reorder_admin_items(p_table text, p_items jsonb, p_tenant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  required_permission text;
  item jsonb;
begin
  required_permission := case
    when p_table in ('products', 'categories') then 'catalog'
    when p_table in ('banners', 'home_sections', 'store_pages', 'page_blocks') then 'store'
    else null
  end;
  if required_permission is null then raise exception 'Tabela não permitida'; end if;
  if not public.has_tenant_permission(p_tenant_id, required_permission) then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then raise exception 'Ordenação inválida'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    execute format('update public.%I set order_index = $1 where tenant_id = $2 and id = $3', p_table)
      using greatest(0, (item->>'order')::integer), p_tenant_id, item->>'id';
  end loop;
end;
$$;
grant execute on function public.reorder_admin_items(text, jsonb, uuid) to authenticated;

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
end;
$$;
grant execute on function public.update_tenant_order_status(uuid, text, text) to authenticated;
revoke execute on function public.update_demo_order_status(text, text) from authenticated;

create or replace function public.queue_order_status_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation public.message_automations%rowtype;
  rendered_subject text;
  rendered_message text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
  for automation in select * from public.message_automations where tenant_id = new.tenant_id and active = true and trigger_status = new.status loop
    rendered_subject := replace(replace(replace(replace(automation.subject, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    rendered_message := replace(replace(replace(replace(automation.message, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    insert into public.message_logs (tenant_id, order_id, order_code, automation_id, automation_name, channel, recipient, subject, message, status)
    values (new.tenant_id, new.id, new.code, automation.id, automation.name, automation.channel, case when automation.channel = 'whatsapp' then coalesce(new.customer->>'phone', '') else coalesce(new.customer->>'email', '') end, rendered_subject, rendered_message, 'simulated');
  end loop;
  return new;
end;
$$;

create or replace function public.capture_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_mail text := '';
  previous_row jsonb;
  current_row jsonb;
  row_data jsonb;
  row_tenant uuid;
  item_id text;
  item_label text;
begin
  if actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  select email into actor_mail from public.profiles where id = actor;
  previous_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  current_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_data := coalesce(current_row, previous_row, '{}'::jsonb);
  row_tenant := nullif(row_data->>'tenant_id', '')::uuid;
  item_id := coalesce(row_data->>'id', '');
  item_label := coalesce(nullif(row_data->>'name', ''), nullif(row_data->>'code', ''), nullif(row_data->>'title', ''), nullif(row_data->>'store_name', ''), item_id);
  insert into public.audit_logs (tenant_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  values (row_tenant, actor, coalesce(actor_mail, ''), lower(tg_op), tg_table_name, item_id, item_label, previous_row, current_row);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.provision_tenant(
  p_name text,
  p_slug text,
  p_whatsapp text,
  p_email text,
  p_primary_color text default '#1677ff',
  p_order_prefix text default 'LOJA',
  p_owner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tenant uuid := gen_random_uuid();
  prefix text := upper(regexp_replace(p_order_prefix, '[^A-Za-z0-9]', '', 'g'));
  home_id text := new_tenant::text || ':home';
begin
  if auth.role() <> 'service_role' and not public.is_platform_admin() then raise exception 'Acesso negado'; end if;
  if p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Slug inválido'; end if;
  if length(prefix) < 2 or length(prefix) > 5 then raise exception 'Prefixo inválido'; end if;
  insert into public.tenants (id, slug, name, status, plan, created_by) values (new_tenant, p_slug, p_name, 'trial', 'starter', p_owner_id);
  insert into public.store_settings (tenant_id, id, store_name, whatsapp, order_prefix, email, hours, announcement, footer_description, primary_color, secondary_color, background_color, text_color, font_family, header_layout, content_width, border_radius, free_shipping_threshold, shipping_flat, pix_discount, auto_banner_seconds, checkout_mode, whatsapp_message)
  values (new_tenant, 'default', p_name, p_whatsapp, prefix, p_email, 'Segunda a sexta · 9h às 18h', 'Fale conosco pelo WhatsApp', 'Catálogo online com atendimento direto pelo WhatsApp.', p_primary_color, '#69a8ff', '#07090d', '#f5f7fb', 'Inter', 'left', 1240, 22, 299, 24.90, 5, 6, 'whatsapp', 'Olá! Quero finalizar o pedido {{pedido}} da {{loja}}.\n\n{{itens}}\n\nTotal: {{total}}\nCliente: {{cliente}}');
  insert into public.store_pages (tenant_id, id, name, slug, title, description, active, show_in_navigation, is_home, order_index)
  values (new_tenant, home_id, 'Página inicial', 'inicio', p_name, 'Página principal da loja.', true, false, true, 1);
  insert into public.page_blocks (tenant_id, id, page_id, kind, name, container_width, padding_size, columns_count, active, order_index) values
    (new_tenant, new_tenant::text || ':hero', home_id, 'hero', 'Banners principais', 'full', 'none', 1, true, 1),
    (new_tenant, new_tenant::text || ':trust', home_id, 'trust', 'Faixa de confiança', 'full', 'none', 4, true, 2),
    (new_tenant, new_tenant::text || ':featured', home_id, 'featured', 'Produtos em destaque', 'normal', 'large', 4, true, 3),
    (new_tenant, new_tenant::text || ':catalog', home_id, 'catalog', 'Catálogo completo', 'normal', 'large', 4, true, 4),
    (new_tenant, new_tenant::text || ':benefits', home_id, 'benefits', 'Benefícios', 'normal', 'large', 4, true, 5),
    (new_tenant, new_tenant::text || ':faq', home_id, 'faq', 'Dúvidas frequentes', 'normal', 'large', 1, true, 6);
  insert into public.home_sections (tenant_id, id, kind, name, eyebrow, title, subtitle, active, order_index) values
    (new_tenant, new_tenant::text || ':section-featured', 'featured', 'Produtos em destaque', 'DESTAQUES', 'Produtos selecionados.', 'Configure os destaques no painel.', true, 1),
    (new_tenant, new_tenant::text || ':section-catalog', 'catalog', 'Catálogo completo', 'CATÁLOGO', 'Encontre o produto certo.', 'Escolha e envie seu pedido pelo WhatsApp.', true, 2),
    (new_tenant, new_tenant::text || ':section-benefits', 'benefits', 'Benefícios', 'POR QUE ESCOLHER', 'Atendimento simples e direto.', '', true, 3),
    (new_tenant, new_tenant::text || ':section-faq', 'faq', 'Dúvidas frequentes', 'AJUDA', 'Informações antes do pedido.', '', true, 4);
  insert into public.categories (tenant_id, id, name, slug, active, order_index)
  values (new_tenant, new_tenant::text || ':category', 'Destaques', 'destaques', true, 1);
  insert into public.banners (tenant_id, id, kicker, title, highlight, subtitle, button_text, button_link, start_color, end_color, image_url, image_only, active, order_index)
  values (new_tenant, new_tenant::text || ':banner', 'BEM-VINDO', 'Conheça nossos produtos.', 'nossos produtos.', 'Escolha seus itens e finalize pelo WhatsApp.', 'Ver catálogo', '#catalogo', '#07101f', p_primary_color, '', false, true, 1);
  insert into public.trust_items (tenant_id, id, title, subtitle, order_index) values
    (new_tenant, new_tenant::text || ':trust-1', 'Escolha seus produtos', 'Monte o carrinho online', 1),
    (new_tenant, new_tenant::text || ':trust-2', 'Fale com a loja', 'Pedido enviado pelo WhatsApp', 2),
    (new_tenant, new_tenant::text || ':trust-3', 'Combine os detalhes', 'Pagamento e entrega no atendimento', 3);
  insert into public.benefits (tenant_id, id, title, text, order_index) values
    (new_tenant, new_tenant::text || ':benefit-1', 'Catálogo organizado', 'Produtos e condições em um só lugar.', 1),
    (new_tenant, new_tenant::text || ':benefit-2', 'Atendimento humano', 'Finalize diretamente com a equipe da loja.', 2);
  insert into public.faqs (tenant_id, id, question, answer, order_index)
  values (new_tenant, new_tenant::text || ':faq-1', 'Como faço o pedido?', 'Adicione os produtos ao carrinho e envie a mensagem pronta pelo WhatsApp.', 1);
  if p_owner_id is not null then
    insert into public.tenant_members (tenant_id, user_id, role, permissions, active)
    values (new_tenant, p_owner_id, 'owner', array['dashboard','orders','catalog','store','marketing','settings','data','users'], true);
  end if;
  return new_tenant;
end;
$$;

revoke all on function public.provision_tenant(text, text, text, text, text, text, uuid) from public;
grant execute on function public.provision_tenant(text, text, text, text, text, text, uuid) to service_role;

-- Arquivos novos usam tenant_id como primeira pasta do objeto.
create or replace function public.storage_tenant_id(object_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(object_name, '/', 1)::uuid
    else null
  end;
$$;

drop policy if exists "admin media insert" on storage.objects;
drop policy if exists "admin media update" on storage.objects;
drop policy if exists "admin media delete" on storage.objects;
drop policy if exists "admin site media insert" on storage.objects;
drop policy if exists "admin site media update" on storage.objects;
drop policy if exists "admin site media delete" on storage.objects;
drop policy if exists "staff product media insert" on storage.objects;
drop policy if exists "staff product media update" on storage.objects;
drop policy if exists "staff product media delete" on storage.objects;
drop policy if exists "staff store media insert" on storage.objects;
drop policy if exists "staff store media update" on storage.objects;
drop policy if exists "staff store media delete" on storage.objects;

create policy "tenant media insert" on storage.objects for insert to authenticated
with check (
  bucket_id in ('product-media', 'banner-media', 'site-media')
  and public.has_tenant_permission(public.storage_tenant_id(name), case when bucket_id = 'product-media' then 'catalog' else 'store' end)
);
create policy "tenant media update" on storage.objects for update to authenticated
using (public.has_tenant_permission(public.storage_tenant_id(name), case when bucket_id = 'product-media' then 'catalog' else 'store' end))
with check (public.has_tenant_permission(public.storage_tenant_id(name), case when bucket_id = 'product-media' then 'catalog' else 'store' end));
create policy "tenant media delete" on storage.objects for delete to authenticated
using (public.has_tenant_permission(public.storage_tenant_id(name), case when bucket_id = 'product-media' then 'catalog' else 'store' end));
