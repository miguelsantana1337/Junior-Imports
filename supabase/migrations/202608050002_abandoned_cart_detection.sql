begin;

create table if not exists public.storefront_cart_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null,
  status text not null default 'active' check (status in ('active', 'recovered', 'dismissed')),
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  contact_allowed boolean not null default false,
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  item_count integer not null default 0 check (item_count >= 0),
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  checkout_started_at timestamptz,
  last_activity_at timestamptz not null default now(),
  recovered_at timestamptz,
  recovered_order_id text references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, session_id)
);

create index if not exists storefront_cart_sessions_monitor_idx
  on public.storefront_cart_sessions (tenant_id, status, last_activity_at desc);

alter table public.storefront_cart_sessions enable row level security;
revoke all on public.storefront_cart_sessions from anon, authenticated;

alter table public.storefront_rate_limits
  drop constraint if exists storefront_rate_limits_action_check;
alter table public.storefront_rate_limits
  add constraint storefront_rate_limits_action_check
  check (action in ('order', 'coupon', 'cart', 'password_reset', 'password_verify', 'login'));

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
  if p_action not in ('order', 'coupon', 'cart', 'password_reset', 'password_verify', 'login') then
    raise exception 'Ação de segurança inválida';
  end if;
  if length(trim(coalesce(p_fingerprint_hash, ''))) < 16 then raise exception 'Identificador de segurança inválido'; end if;
  if p_limit < 1 or p_limit > 100 or p_window_seconds < 10 or p_window_seconds > 86400 then raise exception 'Configuração de limite inválida'; end if;

  delete from public.storefront_rate_limits where updated_at < now() - interval '2 days';
  insert into public.storefront_rate_limits (tenant_id, fingerprint_hash, action, request_count, window_started_at, updated_at)
  values (p_tenant_id, p_fingerprint_hash, p_action, 0, now(), now())
  on conflict (tenant_id, fingerprint_hash, action) do nothing;

  select * into v_row from public.storefront_rate_limits
  where tenant_id = p_tenant_id and fingerprint_hash = p_fingerprint_hash and action = p_action
  for update;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.storefront_rate_limits set request_count = 1, window_started_at = now(), updated_at = now()
    where tenant_id = p_tenant_id and fingerprint_hash = p_fingerprint_hash and action = p_action;
    return jsonb_build_object('allowed', true, 'remaining', p_limit - 1, 'retry_after', 0);
  end if;

  if v_row.request_count >= p_limit then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_row.window_started_at + make_interval(secs => p_window_seconds) - now())))::integer);
    return jsonb_build_object('allowed', false, 'remaining', 0, 'retry_after', v_retry_after);
  end if;

  update public.storefront_rate_limits set request_count = request_count + 1, updated_at = now()
  where tenant_id = p_tenant_id and fingerprint_hash = p_fingerprint_hash and action = p_action;
  return jsonb_build_object('allowed', true, 'remaining', greatest(0, p_limit - v_row.request_count - 1), 'retry_after', 0);
end;
$$;

create or replace function public.clear_storefront_rate_limit(
  p_tenant_id uuid,
  p_fingerprint_hash text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_action not in ('order', 'coupon', 'cart', 'password_reset', 'password_verify', 'login') then raise exception 'Ação de segurança inválida'; end if;
  if length(trim(coalesce(p_fingerprint_hash, ''))) < 16 then raise exception 'Identificador de segurança inválido'; end if;
  delete from public.storefront_rate_limits where tenant_id = p_tenant_id and fingerprint_hash = p_fingerprint_hash and action = p_action;
end;
$$;

revoke all on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer) to service_role;
revoke all on function public.clear_storefront_rate_limit(uuid, text, text) from public, anon, authenticated;
grant execute on function public.clear_storefront_rate_limit(uuid, text, text) to service_role;

commit;
