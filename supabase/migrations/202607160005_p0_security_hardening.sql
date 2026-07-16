begin;

-- P0: reservas temporárias, idempotência e rate limiting distribuído.
create table if not exists public.order_stock_reservations (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'committed', 'released', 'expired')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, order_id, product_id)
);

create index if not exists order_stock_reservations_active
  on public.order_stock_reservations (tenant_id, product_id, expires_at)
  where status = 'active';

create table if not exists public.storefront_order_requests (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  idempotency_key uuid not null,
  request_hash text not null,
  fingerprint_hash text not null default '',
  source text not null default 'storefront' check (source in ('storefront', 'admin')),
  status text not null default 'processing' check (status in ('processing', 'completed')),
  order_id text references public.orders(id) on delete set null,
  response_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, idempotency_key)
);

create index if not exists storefront_order_requests_created
  on public.storefront_order_requests (tenant_id, created_at desc);

create table if not exists public.storefront_rate_limits (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fingerprint_hash text not null,
  action text not null check (action in ('order', 'coupon')),
  request_count integer not null default 0 check (request_count >= 0),
  window_started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, fingerprint_hash, action)
);

alter table public.order_stock_reservations enable row level security;
alter table public.storefront_order_requests enable row level security;
alter table public.storefront_rate_limits enable row level security;

alter table public.orders
  add column if not exists reservation_expires_at timestamptz,
  add column if not exists order_source text not null default 'legacy'
    check (order_source in ('legacy', 'storefront', 'admin'));

alter table public.profiles drop constraint if exists profiles_permissions_check;
alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array[
    'dashboard', 'audit', 'customers', 'crm', 'orders', 'catalog', 'inventory',
    'purchasing', 'finance', 'store', 'marketing', 'settings', 'data', 'users'
  ]::text[]
);

alter table public.tenant_members drop constraint if exists tenant_members_permissions_check;
alter table public.tenant_members add constraint tenant_members_permissions_check check (
  permissions <@ array[
    'dashboard', 'audit', 'customers', 'crm', 'orders', 'catalog', 'inventory',
    'purchasing', 'finance', 'store', 'marketing', 'settings', 'data', 'users'
  ]::text[]
);

create or replace function public.auth_has_aal2()
returns boolean
language sql
stable
set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_has_aal2() and exists(
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
  select
    auth.role() = 'service_role'
    or (
      public.auth_has_aal2()
      and (
        public.is_platform_admin()
        or exists(
          select 1
          from public.tenant_members
          where tenant_id = requested_tenant
            and user_id = auth.uid()
            and active = true
            and (role = 'owner' or requested_permission = any(permissions))
        )
      )
    );
$$;

create or replace function public.has_admin_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_has_aal2() and exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
      and (role = 'owner' or requested_permission = any(permissions))
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.auth_has_aal2() and exists(
    select 1
    from public.profiles
    where id = auth.uid() and active = true and role = 'owner'
  );
$$;

create or replace function public.expire_storefront_reservations(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_ids text[];
  v_expired integer := 0;
begin
  with expired as (
    update public.order_stock_reservations
    set status = 'expired', updated_at = now()
    where tenant_id = p_tenant_id
      and status = 'active'
      and expires_at <= now()
    returning order_id
  )
  select array_agg(distinct order_id), count(distinct order_id)
  into v_order_ids, v_expired
  from expired;

  if coalesce(v_expired, 0) = 0 then
    return 0;
  end if;

  update public.orders
  set status = 'Cancelado'
  where tenant_id = p_tenant_id
    and id = any(v_order_ids)
    and status in ('Novo', 'Aguardando pagamento');

  update public.coupon_redemptions
  set status = 'released', updated_at = now()
  where tenant_id = p_tenant_id
    and order_id = any(v_order_ids)
    and status = 'used';

  insert into public.audit_logs
    (tenant_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  select
    p_tenant_id,
    null,
    'sistema',
    'update',
    'order_reservation',
    order_row.id,
    'Reserva ' || order_row.code,
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'expired', 'expired_at', now())
  from public.orders order_row
  where order_row.tenant_id = p_tenant_id
    and order_row.id = any(v_order_ids);

  return v_expired;
end;
$$;

create or replace function public.consume_storefront_rate_limit(
  p_tenant_id uuid,
  p_fingerprint_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.storefront_rate_limits%rowtype;
  v_retry_after integer := 0;
begin
  if p_action not in ('order', 'coupon') then
    raise exception 'Ação de segurança inválida';
  end if;
  if length(trim(coalesce(p_fingerprint_hash, ''))) < 16 then
    raise exception 'Identificador de segurança inválido';
  end if;
  if p_limit < 1 or p_limit > 100 or p_window_seconds < 10 or p_window_seconds > 86400 then
    raise exception 'Configuração de limite inválida';
  end if;

  delete from public.storefront_rate_limits
  where updated_at < now() - interval '2 days';

  insert into public.storefront_rate_limits
    (tenant_id, fingerprint_hash, action, request_count, window_started_at, updated_at)
  values
    (p_tenant_id, p_fingerprint_hash, p_action, 0, now(), now())
  on conflict (tenant_id, fingerprint_hash, action) do nothing;

  select * into v_row
  from public.storefront_rate_limits
  where tenant_id = p_tenant_id
    and fingerprint_hash = p_fingerprint_hash
    and action = p_action
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.storefront_rate_limits
    set request_count = 1, window_started_at = now(), updated_at = now()
    where tenant_id = p_tenant_id
      and fingerprint_hash = p_fingerprint_hash
      and action = p_action;
    return jsonb_build_object('allowed', true, 'remaining', p_limit - 1, 'retry_after', 0);
  end if;

  if v_row.request_count >= p_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => p_window_seconds) - now())))::integer
    );
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', v_retry_after);
  end if;

  update public.storefront_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where tenant_id = p_tenant_id
    and fingerprint_hash = p_fingerprint_hash
    and action = p_action;

  return jsonb_build_object(
    'allowed', true,
    'remaining', greatest(0, p_limit - v_row.request_count - 1),
    'retry_after', 0
  );
end;
$$;

create or replace function public.validate_storefront_coupon(
  p_tenant_id uuid,
  p_items jsonb,
  p_coupon_code text,
  p_email text default '',
  p_phone text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total_usage integer := 0;
  v_customer_usage integer := 0;
  v_previous_orders integer := 0;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := public.normalize_customer_phone(p_phone);
begin
  perform public.expire_storefront_reservations(p_tenant_id);

  if not public.is_public_tenant(p_tenant_id) then
    return jsonb_build_object('valid', false, 'message', 'Loja indisponível.');
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    return jsonb_build_object('valid', false, 'message', 'Carrinho inválido.');
  end if;
  if length(trim(coalesce(p_coupon_code, ''))) < 3 then
    return jsonb_build_object('valid', false, 'message', 'Cupom inválido ou expirado.');
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 100 then
      return jsonb_build_object('valid', false, 'message', 'Carrinho inválido.');
    end if;
    select * into v_product
    from public.products
    where tenant_id = p_tenant_id
      and id = v_item->>'product_id'
      and active = true;
    if not found then
      return jsonb_build_object('valid', false, 'message', 'Um produto do carrinho não está disponível.');
    end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  select * into v_coupon
  from public.coupons
  where tenant_id = p_tenant_id
    and upper(code) = upper(trim(p_coupon_code));

  if not found or not v_coupon.active then
    return jsonb_build_object('valid', false, 'message', 'Cupom inválido ou expirado.');
  end if;
  if v_coupon.starts_at is not null and v_coupon.starts_at > current_date then
    return jsonb_build_object('valid', false, 'message', 'Cupom inválido ou expirado.');
  end if;
  if v_coupon.expires_at is not null and v_coupon.expires_at < current_date then
    return jsonb_build_object('valid', false, 'message', 'Cupom inválido ou expirado.');
  end if;
  if v_coupon.minimum > v_subtotal then
    return jsonb_build_object('valid', false, 'message', 'O carrinho ainda não atingiu o valor mínimo deste cupom.');
  end if;

  select count(*) into v_total_usage
  from public.coupon_redemptions
  where tenant_id = p_tenant_id and coupon_id = v_coupon.id and status = 'used';

  if v_coupon.total_usage_limit > 0 and v_total_usage >= v_coupon.total_usage_limit then
    return jsonb_build_object('valid', false, 'message', 'Cupom inválido ou expirado.');
  end if;

  if v_email <> '' or v_phone <> '' then
    select count(*) into v_customer_usage
    from public.coupon_redemptions
    where tenant_id = p_tenant_id
      and coupon_id = v_coupon.id
      and status = 'used'
      and ((v_email <> '' and normalized_email = v_email) or (v_phone <> '' and normalized_phone = v_phone));
    if v_coupon.per_customer_limit > 0 and v_customer_usage >= v_coupon.per_customer_limit then
      return jsonb_build_object('valid', false, 'message', 'Este cupom já atingiu o limite para este cliente.');
    end if;

    select count(*) into v_previous_orders
    from public.orders
    where tenant_id = p_tenant_id
      and status <> 'Cancelado'
      and (
        (v_email <> '' and lower(customer->>'email') = v_email)
        or (v_phone <> '' and public.normalize_customer_phone(customer->>'phone') = v_phone)
      );
    if v_coupon.first_order_only and v_previous_orders > 0 then
      return jsonb_build_object('valid', false, 'message', 'Este cupom é válido somente para a primeira compra.');
    end if;
  end if;

  v_discount := case
    when v_coupon.discount_type = 'percent' then v_subtotal * v_coupon.value / 100
    else v_coupon.value
  end;
  v_discount := least(v_discount, v_subtotal);

  return jsonb_build_object(
    'valid', true,
    'code', v_coupon.code,
    'discount', v_discount,
    'subtotal', v_subtotal,
    'requires_identity', v_coupon.per_customer_limit > 0 or v_coupon.first_order_only
  );
end;
$$;

create or replace function public.create_tenant_order_secure(
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
  v_reserved integer := 0;
  v_available integer := 0;
  v_inserted integer := 0;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity integer;
  v_existing public.storefront_order_requests%rowtype;
  v_response jsonb;
  v_expires_at timestamptz;
begin
  if p_source not in ('storefront', 'admin') then raise exception 'Origem do pedido inválida'; end if;
  if length(trim(coalesce(p_request_hash, ''))) < 32 then raise exception 'Assinatura do pedido inválida'; end if;
  if not public.is_public_tenant(p_tenant_id) then raise exception 'Loja indisponível'; end if;

  perform public.expire_storefront_reservations(p_tenant_id);

  insert into public.storefront_order_requests
    (tenant_id, idempotency_key, request_hash, fingerprint_hash, source, status)
  values
    (p_tenant_id, p_idempotency_key, p_request_hash, coalesce(p_fingerprint_hash, ''), p_source, 'processing')
  on conflict (tenant_id, idempotency_key) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    select * into v_existing
    from public.storefront_order_requests
    where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key
    for update;
    if v_existing.request_hash <> p_request_hash then
      raise exception 'Chave de repetição já utilizada por outro pedido';
    end if;
    if v_existing.status = 'completed' and v_existing.response_data is not null then
      return v_existing.response_data || jsonb_build_object('idempotent_replay', true);
    end if;
    raise exception 'Pedido já está em processamento';
  end if;

  if p_payment not in ('Pix', 'Cartao', 'Boleto') then raise exception 'Método de pagamento inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Carrinho vazio'; end if;
  if jsonb_array_length(p_items) > 50 then raise exception 'Carrinho excede o limite de itens'; end if;
  if (select count(distinct value->>'product_id') from jsonb_array_elements(p_items)) <> jsonb_array_length(p_items) then
    raise exception 'O carrinho contém produtos duplicados';
  end if;
  if length(trim(coalesce(p_customer->>'name', ''))) < 3 then raise exception 'Nome do cliente inválido'; end if;
  if v_email !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'E-mail do cliente inválido'; end if;
  if length(v_phone) not between 12 and 13 then raise exception 'Telefone do cliente inválido'; end if;

  v_expires_at := now() + make_interval(mins => greatest(5, least(coalesce(p_reservation_minutes, 30), 1440)));

  select id into v_customer_id from public.customers
  where tenant_id = p_tenant_id
    and ((normalized_email <> '' and normalized_email = v_email) or (normalized_phone <> '' and normalized_phone = v_phone))
  order by updated_at desc limit 1;

  if v_customer_id is null then
    v_customer_id := gen_random_uuid()::text;
    insert into public.customers
      (tenant_id, id, name, email, phone, normalized_email, normalized_phone, city, state, source, whatsapp_consent, email_consent)
    values
      (p_tenant_id, v_customer_id, trim(p_customer->>'name'), p_customer->>'email', p_customer->>'phone',
       v_email, v_phone, coalesce(p_customer->>'city', ''), coalesce(p_customer->>'state', ''),
       'whatsapp', true, false);
  else
    update public.customers set
      name = trim(p_customer->>'name'),
      email = p_customer->>'email',
      phone = p_customer->>'phone',
      normalized_email = v_email,
      normalized_phone = v_phone,
      city = coalesce(p_customer->>'city', city),
      state = coalesce(p_customer->>'state', state),
      updated_at = now()
    where tenant_id = p_tenant_id and id = v_customer_id;
  end if;

  select count(*) into v_previous_orders
  from public.orders
  where tenant_id = p_tenant_id and customer_id = v_customer_id and status <> 'Cancelado';

  select * into v_settings
  from public.store_settings
  where tenant_id = p_tenant_id and id = 'default';
  if not found then raise exception 'Configuração da loja não encontrada'; end if;
  v_code := v_settings.order_prefix || '-' || nextval('public.order_code_seq');

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_quantity := (v_item->>'quantity')::integer;
    if v_quantity < 1 or v_quantity > 100 then raise exception 'Quantidade inválida'; end if;
    select * into v_product
    from public.products
    where tenant_id = p_tenant_id and id = v_item->>'product_id' and active = true
    for update;
    if not found then raise exception 'Produto indisponível'; end if;

    select coalesce(sum(quantity), 0)::integer into v_reserved
    from public.order_stock_reservations
    where tenant_id = p_tenant_id
      and product_id = v_product.id
      and status = 'active'
      and expires_at > now();
    v_available := greatest(0, v_product.stock - v_reserved);
    if v_available < v_quantity then raise exception 'Produto indisponível ou sem estoque suficiente'; end if;
    v_subtotal := v_subtotal + (v_product.price * v_quantity);
  end loop;

  if coalesce(trim(p_coupon_code), '') <> '' then
    select * into v_coupon
    from public.coupons
    where tenant_id = p_tenant_id and upper(code) = upper(trim(p_coupon_code))
    for update;
    if not found or not v_coupon.active then raise exception 'Cupom inválido ou expirado'; end if;
    if v_coupon.starts_at is not null and v_coupon.starts_at > current_date then raise exception 'Cupom inválido ou expirado'; end if;
    if v_coupon.expires_at is not null and v_coupon.expires_at < current_date then raise exception 'Cupom inválido ou expirado'; end if;
    if v_coupon.minimum > v_subtotal then raise exception 'O pedido não atingiu o valor mínimo deste cupom'; end if;

    select count(*) into v_total_usage
    from public.coupon_redemptions
    where tenant_id = p_tenant_id and coupon_id = v_coupon.id and status = 'used';
    if v_coupon.total_usage_limit > 0 and v_total_usage >= v_coupon.total_usage_limit then
      raise exception 'O limite deste cupom foi atingido';
    end if;

    select count(*) into v_customer_usage
    from public.coupon_redemptions
    where tenant_id = p_tenant_id
      and coupon_id = v_coupon.id
      and status = 'used'
      and ((normalized_email <> '' and normalized_email = v_email) or (normalized_phone <> '' and normalized_phone = v_phone));
    if v_coupon.per_customer_limit > 0 and v_customer_usage >= v_coupon.per_customer_limit then
      raise exception 'Este cupom já atingiu o limite para este cliente';
    end if;
    if v_coupon.first_order_only and v_previous_orders > 0 then
      raise exception 'Este cupom é válido somente para a primeira compra';
    end if;

    v_coupon_discount := case
      when v_coupon.discount_type = 'percent' then v_subtotal * v_coupon.value / 100
      else v_coupon.value
    end;
    v_coupon_discount := least(v_coupon_discount, v_subtotal);
  end if;

  if p_payment = 'Pix' then
    v_payment_discount := (v_subtotal - v_coupon_discount) * v_settings.pix_discount / 100;
  end if;
  v_total := greatest(0, v_subtotal - v_coupon_discount - v_payment_discount);
  if not v_settings.free_shipping_enabled or v_total < v_settings.free_shipping_threshold then
    v_shipping := v_settings.shipping_flat;
  end if;
  v_total := v_total + v_shipping;

  insert into public.orders
    (tenant_id, id, customer_id, code, customer, subtotal, discount, shipping, total, payment, status,
     coupon_code, reservation_expires_at, order_source)
  values
    (p_tenant_id, v_order_id, v_customer_id, v_code, p_customer, v_subtotal,
     v_coupon_discount + v_payment_discount, v_shipping, v_total, p_payment, 'Novo',
     case when v_coupon.id is null then '' else v_coupon.code end, v_expires_at, p_source);

  for v_item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    v_quantity := (v_item->>'quantity')::integer;
    select * into v_product
    from public.products
    where tenant_id = p_tenant_id and id = v_item->>'product_id'
    for update;

    insert into public.order_items
      (tenant_id, order_id, product_id, product_name, quantity, unit_price, unit_cost)
    values
      (p_tenant_id, v_order_id, v_product.id, v_product.name, v_quantity, v_product.price, v_product.cost_price);

    insert into public.order_stock_reservations
      (tenant_id, order_id, product_id, quantity, status, expires_at)
    values
      (p_tenant_id, v_order_id, v_product.id, v_quantity, 'active', v_expires_at);
  end loop;

  insert into public.audit_logs
    (tenant_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  values
    (
      p_tenant_id,
      case when p_source = 'admin' then auth.uid() else null end,
      case when p_source = 'admin' then coalesce((select email from public.profiles where id = auth.uid()), 'equipe') else 'storefront' end,
      'insert',
      'order_reservation',
      v_order_id,
      'Reserva ' || v_code,
      null,
      jsonb_build_object(
        'status', 'active',
        'expires_at', v_expires_at,
        'product_count', jsonb_array_length(p_items),
        'source', p_source
      )
    );

  if v_coupon.id is not null then
    insert into public.coupon_redemptions
      (tenant_id, coupon_id, coupon_code, customer_id, order_id, normalized_email, normalized_phone, discount, status)
    values
      (p_tenant_id, v_coupon.id, v_coupon.code, v_customer_id, v_order_id, v_email, v_phone, v_coupon_discount, 'used');
  end if;

  v_response := jsonb_build_object(
    'id', v_order_id,
    'customer_id', v_customer_id,
    'code', v_code,
    'subtotal', v_subtotal,
    'discount', v_coupon_discount + v_payment_discount,
    'shipping', v_shipping,
    'total', v_total,
    'status', 'Novo',
    'created_at', now(),
    'reservation_expires_at', v_expires_at,
    'order_source', p_source,
    'idempotent_replay', false
  );

  update public.storefront_order_requests
  set status = 'completed', order_id = v_order_id, response_data = v_response, updated_at = now()
  where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;

  return v_response;
end;
$$;

create or replace function public.update_tenant_order_status(
  p_tenant_id uuid,
  p_order_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
  v_reservation record;
  v_balance integer;
  v_cost numeric(12,2);
  v_has_reservations boolean := false;
  v_commit_status boolean := p_status in ('Pago', 'Preparando', 'Enviado', 'Entregue');
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then raise exception 'Acesso negado'; end if;
  if p_status not in ('Novo', 'Aguardando pagamento', 'Pago', 'Preparando', 'Enviado', 'Entregue', 'Cancelado') then
    raise exception 'Status inválido';
  end if;

  perform public.expire_storefront_reservations(p_tenant_id);

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;
  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status = 'Cancelado' and p_status <> 'Cancelado' then
    raise exception 'Pedido cancelado ou expirado não pode ser reaberto automaticamente';
  end if;

  select exists(
    select 1 from public.order_stock_reservations
    where tenant_id = p_tenant_id and order_id = p_order_id
  ) into v_has_reservations;

  if v_commit_status and v_order.status not in ('Pago', 'Preparando', 'Enviado', 'Entregue') then
    for v_reservation in
      select * from public.order_stock_reservations
      where tenant_id = p_tenant_id and order_id = p_order_id
      order by product_id
      for update
    loop
      if v_reservation.status in ('expired', 'released') then
        raise exception 'A reserva deste pedido expirou';
      end if;
      if v_reservation.status = 'active' then
        update public.products
        set stock = stock - v_reservation.quantity, updated_at = now()
        where tenant_id = p_tenant_id
          and id = v_reservation.product_id
          and stock >= v_reservation.quantity
        returning stock into v_balance;
        if not found then raise exception 'Estoque insuficiente para confirmar o pedido'; end if;

        insert into public.inventory_movements
          (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note)
        select
          p_tenant_id,
          'sale-' || p_order_id || '-' || v_reservation.product_id,
          v_reservation.product_id,
          'sale',
          -v_reservation.quantity,
          v_balance,
          coalesce(item.unit_cost, 0),
          'order',
          p_order_id,
          'Baixa confirmada do pedido ' || v_order.code
        from public.order_items item
        where item.tenant_id = p_tenant_id
          and item.order_id = p_order_id
          and item.product_id = v_reservation.product_id
        on conflict (id) do nothing;

        update public.order_stock_reservations
        set status = 'committed', updated_at = now()
        where tenant_id = p_tenant_id
          and order_id = p_order_id
          and product_id = v_reservation.product_id;
      end if;
    end loop;
  end if;

  if p_status = 'Cancelado' and v_order.status <> 'Cancelado' then
    if v_has_reservations then
      for v_reservation in
        select * from public.order_stock_reservations
        where tenant_id = p_tenant_id and order_id = p_order_id
        order by product_id
        for update
      loop
        if v_reservation.status = 'committed' then
          update public.products
          set stock = stock + v_reservation.quantity, updated_at = now()
          where tenant_id = p_tenant_id and id = v_reservation.product_id
          returning stock into v_balance;

          insert into public.inventory_movements
            (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note)
          select
            p_tenant_id,
            'cancel-' || p_order_id || '-' || v_reservation.product_id,
            v_reservation.product_id,
            'return',
            v_reservation.quantity,
            v_balance,
            coalesce(item.unit_cost, 0),
            'order',
            p_order_id,
            'Estoque devolvido pelo cancelamento de ' || v_order.code
          from public.order_items item
          where item.tenant_id = p_tenant_id
            and item.order_id = p_order_id
            and item.product_id = v_reservation.product_id
          on conflict (id) do nothing;
        end if;

        update public.order_stock_reservations
        set status = case when status in ('active', 'committed') then 'released' else status end,
            updated_at = now()
        where tenant_id = p_tenant_id
          and order_id = p_order_id
          and product_id = v_reservation.product_id;
      end loop;
    else
      -- Compatibilidade com pedidos antigos, cujo estoque já foi baixado na criação.
      for v_item in
        select * from public.order_items
        where tenant_id = p_tenant_id and order_id = p_order_id
        order by product_id
      loop
        if v_item.product_id is not null then
          update public.products
          set stock = stock + v_item.quantity, updated_at = now()
          where tenant_id = p_tenant_id and id = v_item.product_id
          returning stock into v_balance;

          insert into public.inventory_movements
            (tenant_id, id, product_id, type, quantity, balance_after, unit_cost, reference_type, reference_id, note)
          values
            (p_tenant_id, 'cancel-' || p_order_id || '-' || v_item.product_id, v_item.product_id,
             'return', v_item.quantity, v_balance, v_item.unit_cost, 'order', p_order_id,
             'Estoque devolvido pelo cancelamento de ' || v_order.code)
          on conflict (id) do nothing;
        end if;
      end loop;
    end if;

    update public.financial_transactions
    set status = 'cancelled', updated_at = now()
    where tenant_id = p_tenant_id and order_id = p_order_id;
  elsif p_status = 'Pago' and v_order.status <> 'Pago' then
    select coalesce(sum(quantity * unit_cost), 0) into v_cost
    from public.order_items
    where tenant_id = p_tenant_id and order_id = p_order_id;

    insert into public.financial_transactions
      (tenant_id, id, type, status, description, amount, category, account, cost_center,
       paid_at, order_id, notes, external_key)
    values
      (p_tenant_id, 'order-income-' || p_order_id, 'income', 'paid', 'Venda ' || v_order.code,
       v_order.total, 'Vendas', 'Conta principal', 'Comercial', now(), p_order_id,
       'Gerado automaticamente quando o pedido foi marcado como pago.', 'order-income:' || p_order_id)
    on conflict (tenant_id, external_key) where external_key <> ''
    do update set status = 'paid', amount = excluded.amount, paid_at = excluded.paid_at, updated_at = now();

    if v_cost > 0 then
      insert into public.financial_transactions
        (tenant_id, id, type, status, description, amount, category, account, cost_center,
         paid_at, order_id, notes, external_key)
      values
        (p_tenant_id, 'order-cogs-' || p_order_id, 'expense', 'paid',
         'Custo dos produtos - ' || v_order.code, v_cost, 'CMV', 'Estoque', 'Operação',
         now(), p_order_id, 'Custo congelado nos itens do pedido.', 'order-cogs:' || p_order_id)
      on conflict (tenant_id, external_key) where external_key <> ''
      do update set status = 'paid', amount = excluded.amount, paid_at = excluded.paid_at, updated_at = now();
    end if;
  end if;

  update public.orders
  set status = p_status
  where tenant_id = p_tenant_id and id = p_order_id;

  update public.coupon_redemptions
  set status = case when p_status = 'Cancelado' then 'released' else 'used' end,
      updated_at = now()
  where tenant_id = p_tenant_id and order_id = p_order_id;
end;
$$;

-- Catálogo público com allowlist: custos, estoque mínimo, SKU e saldo exato não saem do banco.
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

drop policy if exists "public tenant products" on public.products;
drop policy if exists "public active products" on public.products;
drop policy if exists "public tenant coupons" on public.coupons;
drop policy if exists "public active coupons" on public.coupons;

-- Storage só pode ser alterado nos buckets públicos esperados.
drop policy if exists "tenant media update" on storage.objects;
create policy "tenant media update" on storage.objects for update to authenticated
using (
  bucket_id in ('product-media', 'banner-media', 'site-media')
  and public.has_tenant_permission(
    public.storage_tenant_id(name),
    case when bucket_id = 'product-media' then 'catalog' else 'store' end
  )
)
with check (
  bucket_id in ('product-media', 'banner-media', 'site-media')
  and public.has_tenant_permission(
    public.storage_tenant_id(name),
    case when bucket_id = 'product-media' then 'catalog' else 'store' end
  )
);

drop policy if exists "tenant media delete" on storage.objects;
create policy "tenant media delete" on storage.objects for delete to authenticated
using (
  bucket_id in ('product-media', 'banner-media', 'site-media')
  and public.has_tenant_permission(
    public.storage_tenant_id(name),
    case when bucket_id = 'product-media' then 'catalog' else 'store' end
  )
);

-- Auditoria minimizada: não duplica contato, endereço, notas ou payload completo.
create or replace function public.audit_safe_snapshot(p_table text, p_row jsonb)
returns jsonb
language plpgsql
immutable
set search_path = public
as $$
begin
  if p_row is null then return null; end if;

  return jsonb_strip_nulls(
    case p_table
      when 'customers' then jsonb_build_object(
        'id', p_row->'id',
        'source', p_row->'source',
        'tags', p_row->'tags',
        'assigned_to', p_row->'assigned_to',
        'whatsapp_consent', p_row->'whatsapp_consent',
        'email_consent', p_row->'email_consent'
      )
      when 'orders' then jsonb_build_object(
        'id', p_row->'id',
        'code', p_row->'code',
        'customer_id', p_row->'customer_id',
        'subtotal', p_row->'subtotal',
        'discount', p_row->'discount',
        'shipping', p_row->'shipping',
        'total', p_row->'total',
        'payment', p_row->'payment',
        'status', p_row->'status',
        'coupon_code', p_row->'coupon_code',
        'order_source', p_row->'order_source'
      )
      when 'financial_transactions' then jsonb_build_object(
        'id', p_row->'id',
        'type', p_row->'type',
        'status', p_row->'status',
        'amount', p_row->'amount',
        'category', p_row->'category',
        'account', p_row->'account',
        'cost_center', p_row->'cost_center',
        'order_id', p_row->'order_id',
        'purchase_order_id', p_row->'purchase_order_id'
      )
      when 'suppliers' then jsonb_build_object(
        'id', p_row->'id',
        'active', p_row->'active',
        'lead_time_days', p_row->'lead_time_days'
      )
      when 'tenant_members' then jsonb_build_object(
        'user_id', p_row->'user_id',
        'role', p_row->'role',
        'permissions', p_row->'permissions',
        'active', p_row->'active'
      )
      when 'products' then jsonb_build_object(
        'id', p_row->'id',
        'name', p_row->'name',
        'active', p_row->'active',
        'featured', p_row->'featured',
        'stock', p_row->'stock',
        'price', p_row->'price'
      )
      else jsonb_build_object(
        'id', p_row->'id',
        'name', p_row->'name',
        'code', p_row->'code',
        'title', p_row->'title',
        'active', p_row->'active',
        'status', p_row->'status',
        'order_index', p_row->'order_index'
      )
    end
  );
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
  previous_row := case when tg_op in ('UPDATE', 'DELETE') then public.audit_safe_snapshot(tg_table_name, to_jsonb(old)) else null end;
  current_row := case when tg_op in ('INSERT', 'UPDATE') then public.audit_safe_snapshot(tg_table_name, to_jsonb(new)) else null end;
  row_data := coalesce(case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end, '{}'::jsonb);
  row_tenant := nullif(row_data->>'tenant_id', '')::uuid;
  item_id := coalesce(row_data->>'id', row_data->>'user_id', '');
  item_label := case
    when tg_table_name = 'customers' then 'Cliente ' || left(item_id, 8)
    when tg_table_name = 'tenant_members' then 'Usuário ' || left(coalesce(row_data->>'user_id', ''), 8)
    else coalesce(
      nullif(row_data->>'code', ''),
      nullif(row_data->>'name', ''),
      nullif(row_data->>'title', ''),
      item_id
    )
  end;

  if row_tenant is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  insert into public.audit_logs
    (tenant_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  values
    (row_tenant, actor, coalesce(actor_mail, ''), lower(tg_op), tg_table_name, item_id, item_label, previous_row, current_row);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop policy if exists "staff audit logs read" on public.audit_logs;
drop policy if exists "tenant audit read" on public.audit_logs;
create policy "tenant security audit read" on public.audit_logs for select to authenticated
using (public.has_tenant_permission(tenant_id, 'audit'));

-- Remove RPCs antigas e fecha execução de funções por padrão.
drop function if exists public.create_demo_order(jsonb, jsonb, text, text);
drop function if exists public.create_tenant_order(uuid, jsonb, jsonb, text, text);
drop function if exists public.update_demo_order_status(text, text);

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

grant execute on function public.auth_has_aal2() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_tenant_permission(uuid, text) to authenticated;
grant execute on function public.is_public_tenant(uuid) to anon, authenticated;
grant execute on function public.has_admin_permission(text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.storage_tenant_id(text) to authenticated;
grant execute on function public.reorder_admin_items(text, jsonb, uuid) to authenticated;
grant execute on function public.update_tenant_order_status(uuid, text, text) to authenticated;
grant execute on function public.record_inventory_movement(uuid, text, text, integer, numeric, text, text, text, text) to authenticated;
grant execute on function public.receive_purchase_order(uuid, text, text) to authenticated;

grant execute on function public.provision_tenant(text, text, text, text, text, text, uuid) to service_role;
grant execute on function public.expire_storefront_reservations(uuid) to service_role;
grant execute on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer) to service_role;
grant execute on function public.validate_storefront_coupon(uuid, jsonb, text, text, text) to service_role;
grant execute on function public.create_tenant_order_secure(uuid, jsonb, jsonb, text, text, uuid, text, text, text, integer) to service_role;

notify pgrst, 'reload schema';

commit;
