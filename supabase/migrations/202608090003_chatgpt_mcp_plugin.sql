begin;

-- Integração privada Junior Imports <-> ChatGPT.
-- Os segredos são opacos, armazenados somente como SHA-256, e nenhuma tabela
-- desta integração fica acessível aos papéis anon/authenticated.
create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null,
  grant_types text[] not null default array['authorization_code', 'refresh_token']::text[],
  response_types text[] not null default array['code']::text[],
  token_endpoint_auth_method text not null default 'none',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists public.mcp_oauth_codes (
  code_hash text primary key,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  redirect_uri text not null,
  scopes text[] not null,
  code_challenge text not null,
  resource text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  scopes text[] not null,
  resource text not null,
  expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_action_confirmations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  tool_name text not null,
  payload_hash text not null,
  summary text not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.mcp_tool_calls (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  tool_name text not null,
  operation text not null check (operation in ('read', 'write')),
  status text not null check (status in ('completed', 'confirmation_required', 'blocked', 'failed')),
  request_hash text not null default '',
  confirmation_id uuid references public.mcp_action_confirmations(id) on delete set null,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  error_code text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists mcp_oauth_codes_expiry on public.mcp_oauth_codes(expires_at);
create index if not exists mcp_oauth_tokens_access on public.mcp_oauth_tokens(access_token_hash) where revoked_at is null;
create index if not exists mcp_oauth_tokens_refresh on public.mcp_oauth_tokens(refresh_token_hash) where revoked_at is null;
create index if not exists mcp_oauth_tokens_user on public.mcp_oauth_tokens(tenant_id, user_id, created_at desc);
create index if not exists mcp_confirmations_expiry on public.mcp_action_confirmations(expires_at) where used_at is null;
create index if not exists mcp_tool_calls_tenant_created on public.mcp_tool_calls(tenant_id, created_at desc);

alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;
alter table public.mcp_action_confirmations enable row level security;
alter table public.mcp_tool_calls enable row level security;

revoke all on table public.mcp_oauth_clients from public, anon, authenticated;
revoke all on table public.mcp_oauth_codes from public, anon, authenticated;
revoke all on table public.mcp_oauth_tokens from public, anon, authenticated;
revoke all on table public.mcp_action_confirmations from public, anon, authenticated;
revoke all on table public.mcp_tool_calls from public, anon, authenticated;
grant all on table public.mcp_oauth_clients to service_role;
grant all on table public.mcp_oauth_codes to service_role;
grant all on table public.mcp_oauth_tokens to service_role;
grant all on table public.mcp_action_confirmations to service_role;
grant all on table public.mcp_tool_calls to service_role;

-- Reconstitui a identidade real dentro da mesma transação da RPC. Assim as
-- regras atuais de tenant, permissão, MFA e auditoria continuam valendo mesmo
-- quando o gateway MCP chama o banco com a chave de serviço no servidor.
create or replace function public.mcp_apply_actor_context(
  p_actor_id uuid,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role text := auth.role();
begin
  if v_caller_role <> 'service_role' then
    raise exception 'Acesso restrito ao gateway MCP';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = p_actor_id and active = true
  ) then
    raise exception 'Usuário administrativo inativo';
  end if;

  perform set_config('request.jwt.claim.sub', p_actor_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', p_actor_id,
      'email', left(coalesce(p_actor_email, ''), 320),
      'role', 'authenticated',
      'aal', 'aal2'
    )::text,
    true
  );
end;
$$;

create or replace function public.mcp_update_tenant_order_lifecycle(
  p_actor_id uuid,
  p_actor_email text,
  p_tenant_id uuid,
  p_order_id text,
  p_operational_status text,
  p_payment_status text,
  p_expected_version integer,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_apply_actor_context(p_actor_id, p_actor_email);
  return public.update_tenant_order_lifecycle(
    p_tenant_id,
    p_order_id,
    p_operational_status,
    p_payment_status,
    p_expected_version,
    p_reason
  );
end;
$$;

create or replace function public.mcp_register_tenant_order_payment(
  p_actor_id uuid,
  p_actor_email text,
  p_tenant_id uuid,
  p_order_id text,
  p_amount numeric,
  p_paid_at timestamptz,
  p_expected_version integer,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_apply_actor_context(p_actor_id, p_actor_email);
  return public.register_tenant_order_payment(
    p_tenant_id,
    p_order_id,
    p_amount,
    p_paid_at,
    p_expected_version,
    p_note
  );
end;
$$;

create or replace function public.mcp_record_inventory_movement(
  p_actor_id uuid,
  p_actor_email text,
  p_tenant_id uuid,
  p_product_id text,
  p_type text,
  p_quantity integer,
  p_unit_cost numeric default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_apply_actor_context(p_actor_id, p_actor_email);
  return public.record_inventory_movement(
    p_tenant_id,
    p_product_id,
    p_type,
    p_quantity,
    p_unit_cost,
    p_note,
    'chatgpt',
    '',
    p_actor_email
  );
end;
$$;

create or replace function public.mcp_set_tenant_order_archived(
  p_actor_id uuid,
  p_actor_email text,
  p_tenant_id uuid,
  p_order_id text,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_apply_actor_context(p_actor_id, p_actor_email);
  return public.set_tenant_order_archived(p_tenant_id, p_order_id, p_archived);
end;
$$;

create or replace function public.mcp_adjust_tenant_order_financial_total(
  p_actor_id uuid,
  p_actor_email text,
  p_tenant_id uuid,
  p_order_id text,
  p_financial_total numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.mcp_apply_actor_context(p_actor_id, p_actor_email);
  return public.adjust_tenant_order_financial_total(
    p_tenant_id,
    p_order_id,
    p_financial_total,
    p_reason
  );
end;
$$;

create or replace function public.mcp_record_financial_transaction(
  p_actor_id uuid,
  p_actor_email text,
  p_tenant_id uuid,
  p_type text,
  p_amount numeric,
  p_category text,
  p_description text,
  p_occurred_at timestamptz,
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := 'mcp-finance-' || gen_random_uuid()::text;
  v_amount numeric(12,2) := round(coalesce(p_amount, 0), 2);
  v_when timestamptz := coalesce(p_occurred_at, now());
begin
  perform public.mcp_apply_actor_context(p_actor_id, p_actor_email);
  if not public.has_tenant_permission(p_tenant_id, 'finance') then
    raise exception 'Acesso negado ao financeiro';
  end if;
  if p_type not in ('income', 'expense') then raise exception 'Tipo financeiro inválido'; end if;
  if v_amount <= 0 or v_amount > 1000000000 then raise exception 'Informe um valor válido'; end if;
  if v_when > now() + interval '5 minutes' then raise exception 'Data financeira inválida'; end if;
  if length(trim(coalesce(p_description, ''))) < 3 then raise exception 'Informe uma descrição'; end if;

  insert into public.financial_transactions (
    tenant_id, id, type, status, description, amount, category, account,
    cost_center, due_date, paid_at, recurring, notes, external_key, created_at
  ) values (
    p_tenant_id,
    v_id,
    p_type,
    'paid',
    left(trim(p_description), 200),
    v_amount,
    left(coalesce(nullif(trim(p_category), ''), 'Outros'), 120),
    'Conta principal',
    'Operação',
    timezone('America/Sao_Paulo', v_when)::date,
    v_when,
    false,
    left(trim(coalesce(p_notes, '')), 500),
    'chatgpt:' || v_id,
    now()
  );

  return jsonb_build_object(
    'id', v_id,
    'type', p_type,
    'amount', v_amount,
    'category', p_category,
    'description', p_description,
    'paid_at', v_when
  );
end;
$$;

create or replace function public.cleanup_expired_mcp_records()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  delete from public.mcp_oauth_codes where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day';
  delete from public.mcp_action_confirmations where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day';
  delete from public.mcp_oauth_tokens
  where coalesce(refresh_expires_at, expires_at) < now() - interval '30 days'
     or revoked_at < now() - interval '30 days';
end;
$$;

revoke all on function public.mcp_apply_actor_context(uuid, text) from public, anon, authenticated;
revoke all on function public.mcp_update_tenant_order_lifecycle(uuid, text, uuid, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.mcp_register_tenant_order_payment(uuid, text, uuid, text, numeric, timestamptz, integer, text) from public, anon, authenticated;
revoke all on function public.mcp_record_inventory_movement(uuid, text, uuid, text, text, integer, numeric, text) from public, anon, authenticated;
revoke all on function public.mcp_set_tenant_order_archived(uuid, text, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.mcp_adjust_tenant_order_financial_total(uuid, text, uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.mcp_record_financial_transaction(uuid, text, uuid, text, numeric, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.cleanup_expired_mcp_records() from public, anon, authenticated;

grant execute on function public.mcp_apply_actor_context(uuid, text) to service_role;
grant execute on function public.mcp_update_tenant_order_lifecycle(uuid, text, uuid, text, text, text, integer, text) to service_role;
grant execute on function public.mcp_register_tenant_order_payment(uuid, text, uuid, text, numeric, timestamptz, integer, text) to service_role;
grant execute on function public.mcp_record_inventory_movement(uuid, text, uuid, text, text, integer, numeric, text) to service_role;
grant execute on function public.mcp_set_tenant_order_archived(uuid, text, uuid, text, boolean) to service_role;
grant execute on function public.mcp_adjust_tenant_order_financial_total(uuid, text, uuid, text, numeric, text) to service_role;
grant execute on function public.mcp_record_financial_transaction(uuid, text, uuid, text, numeric, text, text, timestamptz, text) to service_role;
grant execute on function public.cleanup_expired_mcp_records() to service_role;

commit;
