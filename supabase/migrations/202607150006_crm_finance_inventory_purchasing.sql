-- CRM operacional, financeiro, estoque e compras.
-- As funcoes abaixo concentram as alteracoes criticas para manter estoque e financeiro consistentes.

alter table public.products
  add column if not exists cost_price numeric(12,2) not null default 0,
  add column if not exists min_stock integer not null default 5;

alter table public.order_items
  add column if not exists unit_cost numeric(12,2) not null default 0;

alter table public.customers
  add column if not exists assigned_to text not null default '',
  add column if not exists whatsapp_consent boolean not null default false,
  add column if not exists email_consent boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_cost_price_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_cost_price_check check (cost_price >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_min_stock_check' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_min_stock_check check (min_stock >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'order_items_unit_cost_check' and conrelid = 'public.order_items'::regclass) then
    alter table public.order_items add constraint order_items_unit_cost_check check (unit_cost >= 0);
  end if;
end $$;

create table if not exists public.customer_tasks (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  assigned_to text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.customer_contacts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'phone', 'instagram', 'email', 'other')),
  result text not null check (result in ('answered', 'no_answer', 'sale', 'follow_up', 'opt_out')),
  summary text not null,
  next_step_at timestamptz,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  name text not null,
  tax_id text not null default '',
  email text not null default '',
  phone text not null default '',
  lead_time_days integer not null default 0 check (lead_time_days >= 0),
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create sequence if not exists public.purchase_order_code_seq start 1001;

create table if not exists public.purchase_orders (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  code text not null default ('OC-' || nextval('public.purchase_order_code_seq')),
  supplier_id text references public.suppliers(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  expected_at date,
  received_at timestamptz,
  total numeric(12,2) not null default 0 check (total >= 0),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists public.purchase_order_items (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  purchase_order_id text not null references public.purchase_orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null check (unit_cost >= 0),
  lot_code text not null default '',
  expiry_date date
);

create table if not exists public.financial_transactions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  type text not null check (type in ('income', 'expense')),
  status text not null default 'pending' check (status in ('pending', 'paid', 'cancelled')),
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  category text not null default 'Outros',
  account text not null default 'Conta principal',
  cost_center text not null default '',
  due_date date,
  paid_at timestamptz,
  order_id text references public.orders(id) on delete set null,
  purchase_order_id text references public.purchase_orders(id) on delete set null,
  recurring boolean not null default false,
  notes text not null default '',
  external_key text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_transactions_tenant_external_key
  on public.financial_transactions (tenant_id, external_key) where external_key <> '';

create table if not exists public.inventory_movements (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete restrict,
  type text not null check (type in ('opening', 'purchase', 'sale', 'return', 'adjustment', 'loss', 'transfer')),
  quantity integer not null check (quantity <> 0),
  balance_after integer not null check (balance_after >= 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  reference_type text not null default '',
  reference_id text not null default '',
  note text not null default '',
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.product_lots (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  code text not null,
  expiry_date date,
  quantity integer not null default 0 check (quantity >= 0),
  status text not null default 'available' check (status in ('available', 'blocked', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id, code)
);

create index if not exists customer_tasks_tenant_due on public.customer_tasks (tenant_id, status, due_at);
create index if not exists customer_contacts_tenant_customer on public.customer_contacts (tenant_id, customer_id, created_at desc);
create index if not exists financial_transactions_tenant_due on public.financial_transactions (tenant_id, status, due_date);
create index if not exists inventory_movements_tenant_product on public.inventory_movements (tenant_id, product_id, created_at desc);
create index if not exists product_lots_tenant_expiry on public.product_lots (tenant_id, expiry_date) where status = 'available';
create index if not exists purchase_orders_tenant_created on public.purchase_orders (tenant_id, created_at desc);

alter table public.customer_tasks enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.product_lots enable row level security;
alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "tenant customer tasks manage" on public.customer_tasks;
create policy "tenant customer tasks manage" on public.customer_tasks for all to authenticated
using (public.has_tenant_permission(tenant_id, 'crm')) with check (public.has_tenant_permission(tenant_id, 'crm'));
drop policy if exists "tenant customer contacts manage" on public.customer_contacts;
create policy "tenant customer contacts manage" on public.customer_contacts for all to authenticated
using (public.has_tenant_permission(tenant_id, 'crm')) with check (public.has_tenant_permission(tenant_id, 'crm'));
drop policy if exists "tenant financial transactions manage" on public.financial_transactions;
create policy "tenant financial transactions manage" on public.financial_transactions for all to authenticated
using (public.has_tenant_permission(tenant_id, 'finance')) with check (public.has_tenant_permission(tenant_id, 'finance'));
drop policy if exists "tenant inventory movements manage" on public.inventory_movements;
create policy "tenant inventory movements manage" on public.inventory_movements for all to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory')) with check (public.has_tenant_permission(tenant_id, 'inventory'));
drop policy if exists "tenant product lots manage" on public.product_lots;
create policy "tenant product lots manage" on public.product_lots for all to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory')) with check (public.has_tenant_permission(tenant_id, 'inventory'));
drop policy if exists "tenant suppliers manage" on public.suppliers;
create policy "tenant suppliers manage" on public.suppliers for all to authenticated
using (public.has_tenant_permission(tenant_id, 'purchasing')) with check (public.has_tenant_permission(tenant_id, 'purchasing'));
drop policy if exists "tenant purchase orders manage" on public.purchase_orders;
create policy "tenant purchase orders manage" on public.purchase_orders for all to authenticated
using (public.has_tenant_permission(tenant_id, 'purchasing')) with check (public.has_tenant_permission(tenant_id, 'purchasing'));
drop policy if exists "tenant purchase order items manage" on public.purchase_order_items;
create policy "tenant purchase order items manage" on public.purchase_order_items for all to authenticated
using (public.has_tenant_permission(tenant_id, 'purchasing')) with check (public.has_tenant_permission(tenant_id, 'purchasing'));

alter table public.profiles drop constraint if exists profiles_permissions_check;
alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array['dashboard', 'customers', 'crm', 'orders', 'catalog', 'inventory', 'purchasing', 'finance', 'store', 'marketing', 'settings', 'data', 'users']::text[]
);
alter table public.tenant_members drop constraint if exists tenant_members_permissions_check;
alter table public.tenant_members add constraint tenant_members_permissions_check check (
  permissions <@ array['dashboard', 'customers', 'crm', 'orders', 'catalog', 'inventory', 'purchasing', 'finance', 'store', 'marketing', 'settings', 'data', 'users']::text[]
);

update public.profiles
set permissions = permissions || array['crm', 'inventory', 'purchasing', 'finance']::text[]
where active = true and role in ('owner', 'manager')
  and not (permissions @> array['crm', 'inventory', 'purchasing', 'finance']::text[]);
update public.profiles
set permissions = array_append(permissions, 'crm')
where active = true and role = 'support' and not ('crm' = any(permissions));
update public.tenant_members
set permissions = permissions || array['crm', 'inventory', 'purchasing', 'finance']::text[]
where active = true and role in ('owner', 'manager')
  and not (permissions @> array['crm', 'inventory', 'purchasing', 'finance']::text[]);
update public.tenant_members
set permissions = array_append(permissions, 'crm')
where active = true and role = 'support' and not ('crm' = any(permissions));

-- Evita duplicatas quando uma permissao ja existia parcialmente.
update public.profiles profile
set permissions = (select array_agg(distinct permission) from unnest(profile.permissions) permission);
update public.tenant_members member
set permissions = (select array_agg(distinct permission) from unnest(member.permissions) permission);

create or replace function public.record_inventory_movement(
  p_tenant_id uuid,
  p_product_id text,
  p_type text,
  p_quantity integer,
  p_unit_cost numeric default 0,
  p_note text default '',
  p_reference_type text default '',
  p_reference_id text default '',
  p_actor_email text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_delta integer;
  v_balance integer;
  v_id text := gen_random_uuid()::text;
begin
  if not (public.has_tenant_permission(p_tenant_id, 'inventory') or public.has_tenant_permission(p_tenant_id, 'catalog')) then
    raise exception 'Acesso negado ao estoque';
  end if;
  if p_type not in ('opening', 'purchase', 'sale', 'return', 'adjustment', 'loss', 'transfer') then raise exception 'Tipo de movimento invalido'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'A quantidade deve ser maior que zero'; end if;

  select * into v_product from public.products
  where tenant_id = p_tenant_id and id = p_product_id for update;
  if not found then raise exception 'Produto nao encontrado'; end if;

  v_delta := case when p_type in ('sale', 'loss') then -p_quantity else p_quantity end;
  v_balance := v_product.stock + v_delta;
  if v_balance < 0 then raise exception 'Estoque insuficiente. Saldo atual: %', v_product.stock; end if;

  update public.products
  set stock = v_balance,
      cost_price = case when p_type = 'purchase' and coalesce(p_unit_cost, 0) > 0 then p_unit_cost else cost_price end,
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_product_id;

  insert into public.inventory_movements
    (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note, actor_email)
  values
    (p_tenant_id, v_id, p_product_id, p_type, v_delta, v_balance, greatest(coalesce(p_unit_cost, 0), 0), coalesce(p_reference_type, ''), coalesce(p_reference_id, ''), coalesce(p_note, ''), coalesce(p_actor_email, ''));

  return jsonb_build_object('id', v_id, 'balance_after', v_balance, 'quantity', v_delta);
end;
$$;

create or replace function public.receive_purchase_order(
  p_tenant_id uuid,
  p_purchase_order_id text,
  p_actor_email text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.purchase_orders%rowtype;
  v_item record;
  v_product public.products%rowtype;
  v_balance integer;
begin
  if not public.has_tenant_permission(p_tenant_id, 'purchasing') then raise exception 'Acesso negado a compras'; end if;
  select * into v_order from public.purchase_orders
  where tenant_id = p_tenant_id and id = p_purchase_order_id for update;
  if not found then raise exception 'Ordem de compra nao encontrada'; end if;
  if v_order.status = 'received' then raise exception 'Esta ordem de compra ja foi recebida'; end if;
  if v_order.status = 'cancelled' then raise exception 'Uma ordem cancelada nao pode ser recebida'; end if;
  if not exists (select 1 from public.purchase_order_items where tenant_id = p_tenant_id and purchase_order_id = v_order.id) then
    raise exception 'Adicione ao menos um item antes de receber a compra';
  end if;

  for v_item in
    select * from public.purchase_order_items
    where tenant_id = p_tenant_id and purchase_order_id = v_order.id
    order by id
  loop
    select * into v_product from public.products
    where tenant_id = p_tenant_id and id = v_item.product_id for update;
    if not found then raise exception 'Produto % nao encontrado', v_item.product_name; end if;
    v_balance := v_product.stock + v_item.quantity;
    update public.products set stock = v_balance, cost_price = v_item.unit_cost, updated_at = now()
    where tenant_id = p_tenant_id and id = v_item.product_id;
    insert into public.inventory_movements
      (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note, actor_email)
    values
      (p_tenant_id, 'purchase-' || v_order.id || '-' || v_item.id, v_item.product_id, 'purchase', v_item.quantity, v_balance, v_item.unit_cost, 'purchase_order', v_order.id, 'Recebimento da ' || v_order.code || '.', coalesce(p_actor_email, ''))
    on conflict (id) do nothing;
    if trim(v_item.lot_code) <> '' then
      insert into public.product_lots (tenant_id, id, product_id, code, expiry_date, quantity, status)
      values (p_tenant_id, 'lot-' || v_order.id || '-' || v_item.id, v_item.product_id, v_item.lot_code, v_item.expiry_date, v_item.quantity, 'available')
      on conflict (tenant_id, product_id, code) do update
      set quantity = public.product_lots.quantity + excluded.quantity,
          expiry_date = excluded.expiry_date,
          status = 'available',
          updated_at = now();
    end if;
  end loop;

  insert into public.financial_transactions
    (tenant_id, id, type, status, description, amount, category, account, cost_center, due_date, purchase_order_id, notes, external_key)
  values
    (p_tenant_id, 'purchase-payable-' || v_order.id, 'expense', 'pending', 'Compra ' || v_order.code, v_order.total, 'Compras', 'Conta principal', 'Estoque', v_order.expected_at, v_order.id, 'Gerado automaticamente pelo recebimento da ordem de compra.', 'purchase:' || v_order.id)
  on conflict (tenant_id, external_key) where external_key <> '' do nothing;

  update public.purchase_orders set status = 'received', received_at = now(), updated_at = now()
  where tenant_id = p_tenant_id and id = v_order.id;
end;
$$;

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
  v_balance integer;
begin
  if not public.is_public_tenant(p_tenant_id) then raise exception 'Loja indisponivel'; end if;
  if p_payment not in ('Pix', 'Cartao', 'Boleto') then raise exception 'Metodo de pagamento invalido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Carrinho excede o limite de itens'; end if;
  if (select count(distinct value->>'product_id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception 'O carrinho contem produtos duplicados';
  end if;
  if length(trim(coalesce(p_customer->>'name', ''))) < 3 then raise exception 'Nome do cliente invalido'; end if;
  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'E-mail do cliente invalido'; end if;
  if length(v_phone) not between 12 and 13 then raise exception 'Telefone do cliente invalido'; end if;

  select id into v_customer_id from public.customers
  where tenant_id = p_tenant_id
    and ((normalized_email <> '' and normalized_email = v_email) or (normalized_phone <> '' and normalized_phone = v_phone))
  order by updated_at desc limit 1;
  if v_customer_id is null then
    v_customer_id := gen_random_uuid()::text;
    insert into public.customers (tenant_id, id, name, email, phone, normalized_email, normalized_phone, city, state, source, whatsapp_consent, email_consent)
    values (p_tenant_id, v_customer_id, trim(p_customer->>'name'), p_customer->>'email', p_customer->>'phone', v_email, v_phone, coalesce(p_customer->>'city', ''), coalesce(p_customer->>'state', ''), 'whatsapp', true, false);
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
  if not found then raise exception 'Configuracao da loja nao encontrada'; end if;
  v_code := v_settings.order_prefix || '-' || nextval('public.order_code_seq');

  -- Trava todos os produtos antes de calcular para impedir venda concorrente acima do estoque.
  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 100 then raise exception 'Quantidade invalida'; end if;
    select * into v_product from public.products
    where tenant_id = p_tenant_id and id = v_item->>'product_id' and active = true for update;
    if not found or v_product.stock < v_quantity then raise exception 'Produto indisponivel ou sem estoque suficiente'; end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if coalesce(trim(p_coupon_code), '') <> '' then
    select * into v_coupon from public.coupons
    where tenant_id = p_tenant_id and upper(code) = upper(trim(p_coupon_code)) for update;
    if not found or not v_coupon.active then raise exception 'Cupom invalido ou inativo'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > current_date then raise exception 'Este cupom ainda nao esta disponivel'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < current_date then raise exception 'Este cupom expirou'; end if;
    if v_coupon.minimum > v_subtotal then raise exception 'O pedido nao atingiu o valor minimo deste cupom'; end if;
    select count(*) into v_total_usage from public.coupon_redemptions where tenant_id = p_tenant_id and coupon_id = v_coupon.id and status = 'used';
    if v_coupon.total_usage_limit > 0 and v_total_usage >= v_coupon.total_usage_limit then raise exception 'O limite total de utilizacoes deste cupom foi atingido'; end if;
    select count(*) into v_customer_usage from public.coupon_redemptions
    where tenant_id = p_tenant_id and coupon_id = v_coupon.id and status = 'used'
      and ((normalized_email <> '' and normalized_email = v_email) or (normalized_phone <> '' and normalized_phone = v_phone));
    if v_coupon.per_customer_limit > 0 and v_customer_usage >= v_coupon.per_customer_limit then raise exception 'Este cupom ja atingiu o limite de uso para este cliente'; end if;
    if v_coupon.first_order_only and v_previous_orders > 0 then raise exception 'Este cupom e valido somente para a primeira compra'; end if;
    v_coupon_discount := case when v_coupon.discount_type = 'percent' then v_subtotal * v_coupon.value / 100 else v_coupon.value end;
    v_coupon_discount := least(v_coupon_discount, v_subtotal);
  end if;

  if p_payment = 'Pix' then v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100; end if;
  v_total := greatest(0, v_subtotal - v_coupon_discount - v_payment_discount);
  if not v_settings.free_shipping_enabled or v_total < v_settings.free_shipping_threshold then v_shipping := v_settings.shipping_flat; end if;
  v_total := v_total + v_shipping;

  insert into public.orders (tenant_id, id, customer_id, code, customer, subtotal, discount, shipping, total, payment, status, coupon_code)
  values (p_tenant_id, v_order_id, v_customer_id, v_code, p_customer, v_subtotal, v_coupon_discount + v_payment_discount, v_shipping, v_total, p_payment, 'Novo', case when v_coupon.id is null then '' else v_coupon.code end);

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product from public.products where tenant_id = p_tenant_id and id = v_item->>'product_id' for update;
    v_balance := v_product.stock - v_quantity;
    update public.products set stock = v_balance, updated_at = now() where tenant_id = p_tenant_id and id = v_product.id;
    insert into public.order_items (tenant_id, order_id, product_id, product_name, quantity, unit_price, unit_cost)
    values (p_tenant_id, v_order_id, v_product.id, v_product.name, v_quantity, v_product.price, v_product.cost_price);
    insert into public.inventory_movements
      (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note)
    values
      (p_tenant_id, 'sale-' || v_order_id || '-' || v_product.id, v_product.id, 'sale', -v_quantity, v_balance, v_product.cost_price, 'order', v_order_id, 'Reserva automatica do pedido ' || v_code)
    on conflict (id) do nothing;
  end loop;

  if v_coupon.id is not null then
    insert into public.coupon_redemptions (tenant_id, coupon_id, coupon_code, customer_id, order_id, normalized_email, normalized_phone, discount, status)
    values (p_tenant_id, v_coupon.id, v_coupon.code, v_customer_id, v_order_id, v_email, v_phone, v_coupon_discount, 'used');
  end if;
  return jsonb_build_object('id', v_order_id, 'customer_id', v_customer_id, 'code', v_code, 'subtotal', v_subtotal, 'discount', v_coupon_discount + v_payment_discount, 'shipping', v_shipping, 'total', v_total, 'status', 'Novo', 'created_at', now());
end;
$$;

create or replace function public.update_tenant_order_status(p_tenant_id uuid, p_order_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_balance integer;
  v_cost numeric(12,2);
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then raise exception 'Acesso negado'; end if;
  if p_status not in ('Novo', 'Aguardando pagamento', 'Pago', 'Preparando', 'Enviado', 'Entregue', 'Cancelado') then raise exception 'Status invalido'; end if;
  select * into v_order from public.orders where tenant_id = p_tenant_id and id = p_order_id for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;
  if v_order.status = 'Cancelado' and p_status <> 'Cancelado' then raise exception 'Pedido cancelado nao pode ser reaberto automaticamente'; end if;

  update public.orders set status = p_status where tenant_id = p_tenant_id and id = p_order_id;
  update public.coupon_redemptions
  set status = case when p_status = 'Cancelado' then 'released' else 'used' end, updated_at = now()
  where tenant_id = p_tenant_id and order_id = p_order_id;

  if p_status = 'Cancelado' and v_order.status <> 'Cancelado' then
    for v_item in select * from public.order_items where tenant_id = p_tenant_id and order_id = p_order_id order by product_id loop
      if v_item.product_id is not null then
        update public.products set stock = stock + v_item.quantity, updated_at = now()
        where tenant_id = p_tenant_id and id = v_item.product_id returning stock into v_balance;
        insert into public.inventory_movements
          (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note)
        values
          (p_tenant_id, 'cancel-' || p_order_id || '-' || v_item.product_id, v_item.product_id, 'return', v_item.quantity, v_balance, v_item.unit_cost, 'order', p_order_id, 'Estoque devolvido pelo cancelamento de ' || v_order.code)
        on conflict (id) do nothing;
      end if;
    end loop;
    update public.financial_transactions set status = 'cancelled', updated_at = now()
    where tenant_id = p_tenant_id and order_id = p_order_id;
  elsif p_status = 'Pago' and v_order.status <> 'Pago' then
    select coalesce(sum(quantity * unit_cost), 0) into v_cost
    from public.order_items where tenant_id = p_tenant_id and order_id = p_order_id;
    insert into public.financial_transactions
      (tenant_id, id, type, status, description, amount, category, account, cost_center, paid_at, order_id, notes, external_key)
    values
      (p_tenant_id, 'order-income-' || p_order_id, 'income', 'paid', 'Venda ' || v_order.code, v_order.total, 'Vendas', 'Conta principal', 'Comercial', now(), p_order_id, 'Gerado automaticamente quando o pedido foi marcado como pago.', 'order-income:' || p_order_id)
    on conflict (tenant_id, external_key) where external_key <> '' do update set status = 'paid', amount = excluded.amount, paid_at = excluded.paid_at, updated_at = now();
    if v_cost > 0 then
      insert into public.financial_transactions
        (tenant_id, id, type, status, description, amount, category, account, cost_center, paid_at, order_id, notes, external_key)
      values
        (p_tenant_id, 'order-cogs-' || p_order_id, 'expense', 'paid', 'Custo dos produtos - ' || v_order.code, v_cost, 'CMV', 'Estoque', 'Operacao', now(), p_order_id, 'Custo congelado nos itens do pedido.', 'order-cogs:' || p_order_id)
      on conflict (tenant_id, external_key) where external_key <> '' do update set status = 'paid', amount = excluded.amount, paid_at = excluded.paid_at, updated_at = now();
    end if;
  end if;
end;
$$;

grant execute on function public.record_inventory_movement(uuid, text, text, integer, numeric, text, text, text, text) to authenticated;
grant execute on function public.receive_purchase_order(uuid, text, text) to authenticated;
grant execute on function public.create_tenant_order(uuid, jsonb, jsonb, text, text) to anon, authenticated;
grant execute on function public.update_tenant_order_status(uuid, text, text) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customer_tasks', 'customer_contacts', 'financial_transactions', 'inventory_movements',
    'product_lots', 'suppliers', 'purchase_orders', 'purchase_order_items'
  ] loop
    execute format('drop trigger if exists admin_audit_change on public.%I', table_name);
    execute format('create trigger admin_audit_change after insert or update or delete on public.%I for each row execute function public.capture_admin_audit()', table_name);
  end loop;
end $$;
