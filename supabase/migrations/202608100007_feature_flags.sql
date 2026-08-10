begin;

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  key text not null,
  name text not null,
  description text not null default '',
  enabled boolean not null default false,
  kill_switch boolean not null default false,
  default_value jsonb not null default 'false'::jsonb,
  variant jsonb not null default 'true'::jsonb,
  rollout_percentage numeric(5,2) not null default 0 check (rollout_percentage between 0 and 100),
  audience jsonb not null default '{}'::jsonb,
  environment text not null default 'production' check (environment in ('development', 'preview', 'production', 'all')),
  starts_at timestamptz,
  ends_at timestamptz,
  owner_email text not null default '',
  reason text not null default '',
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key, environment),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.feature_flag_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  before_data jsonb,
  after_data jsonb not null,
  actor_id uuid,
  reason text not null,
  created_at timestamptz not null default now()
);

create index if not exists feature_flags_lookup_idx
  on public.feature_flags (tenant_id, key, environment, enabled);
create index if not exists feature_flag_history_idx
  on public.feature_flag_history (tenant_id, feature_flag_id, created_at desc);

alter table public.feature_flags enable row level security;
alter table public.feature_flag_history enable row level security;

drop policy if exists "tenant feature flags read" on public.feature_flags;
create policy "tenant feature flags read" on public.feature_flags for select to authenticated
using (public.has_tenant_permission(tenant_id, 'settings') or public.has_tenant_permission(tenant_id, 'dashboard'));
drop policy if exists "tenant feature flags manage" on public.feature_flags;
create policy "tenant feature flags manage" on public.feature_flags for all to authenticated
using (public.has_tenant_permission(tenant_id, 'settings'))
with check (public.has_tenant_permission(tenant_id, 'settings'));
drop policy if exists "tenant feature flag history read" on public.feature_flag_history;
create policy "tenant feature flag history read" on public.feature_flag_history for select to authenticated
using (public.has_tenant_permission(tenant_id, 'settings'));

revoke all on table public.feature_flags, public.feature_flag_history from anon, authenticated;
grant select, insert, update, delete on table public.feature_flags to authenticated;
grant select on table public.feature_flag_history to authenticated;

create or replace function public.capture_feature_flag_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.feature_flag_history (tenant_id, feature_flag_id, before_data, after_data, actor_id, reason)
    values (new.tenant_id, new.id, null, to_jsonb(new), new.updated_by, coalesce(new.reason, 'Criação da flag'));
  elsif to_jsonb(old) is distinct from to_jsonb(new) then
    insert into public.feature_flag_history (tenant_id, feature_flag_id, before_data, after_data, actor_id, reason)
    values (new.tenant_id, new.id, to_jsonb(old), to_jsonb(new), new.updated_by, coalesce(nullif(new.reason, ''), 'Atualização da flag'));
  end if;
  return new;
end;
$$;

drop trigger if exists capture_feature_flag_history on public.feature_flags;
create trigger capture_feature_flag_history
after insert or update on public.feature_flags
for each row execute function public.capture_feature_flag_history();

create or replace function public.evaluate_feature_flag(
  p_tenant_id uuid,
  p_key text,
  p_environment text,
  p_subject text default '',
  p_role text default ''
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_flag public.feature_flags%rowtype;
  v_bucket integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  select * into v_flag from public.feature_flags
  where tenant_id = p_tenant_id and key = p_key
    and environment in (p_environment, 'all')
  order by case when environment = p_environment then 0 else 1 end
  limit 1;
  if not found then return 'false'::jsonb; end if;
  if not v_flag.enabled or v_flag.kill_switch then return v_flag.default_value; end if;
  if v_flag.starts_at is not null and v_flag.starts_at > now() then return v_flag.default_value; end if;
  if v_flag.ends_at is not null and v_flag.ends_at < now() then return v_flag.default_value; end if;
  if v_flag.audience ? 'roles' and not exists (
    select 1 from jsonb_array_elements_text(v_flag.audience->'roles') role where role = p_role
  ) then return v_flag.default_value; end if;
  v_bucket := abs(hashtextextended(coalesce(nullif(p_subject, ''), 'anonymous'), 0) % 10000)::integer;
  if v_bucket >= floor(v_flag.rollout_percentage * 100)::integer then return v_flag.default_value; end if;
  return v_flag.variant;
end;
$$;

revoke all on function public.evaluate_feature_flag(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.evaluate_feature_flag(uuid, text, text, text, text) to service_role;

insert into public.feature_flags (
  tenant_id, key, name, description, enabled, rollout_percentage, audience, environment, reason
)
select tenant.id, seed.key, seed.name, seed.description, true, 100, seed.audience, 'production', 'Admin 3.1 validado para ativação controlada'
from public.tenants tenant
cross join (values
  ('reconciliation_center', 'Central de divergências', 'Reconciliação de pedido, estoque, financeiro e cashback.', '{"roles":["owner","manager"]}'::jsonb),
  ('campaign_guardian', 'Guardião financeiro', 'Simulação obrigatória de margem antes de campanhas.', '{"roles":["owner","manager"]}'::jsonb),
  ('referral_program', 'Programa de indicação', 'Código de indicação e recompensa após quitação.', '{}'::jsonb),
  ('configurable_bundles', 'Kits configuráveis', 'Escolha de componentes e baixa por produto.', '{}'::jsonb),
  ('conversion_funnel', 'Funil de conversão', 'Eventos e recuperação humana de carrinhos.', '{}'::jsonb),
  ('mobile_operations', 'Operação móvel', 'Código de barras, voz como rascunho e reversões.', '{"roles":["owner","manager","support"]}'::jsonb),
  ('chatgpt_mutations', 'Ações do ChatGPT', 'Mutações protegidas por confirmação explícita.', '{"roles":["owner","manager"]}'::jsonb)
) as seed(key, name, description, audience)
on conflict (tenant_id, key, environment) do nothing;

commit;
