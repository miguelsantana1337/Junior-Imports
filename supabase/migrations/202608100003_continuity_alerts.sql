begin;

alter table public.orders add column if not exists correlation_id uuid;
alter table public.financial_transactions add column if not exists correlation_id uuid;
alter table public.inventory_movements add column if not exists correlation_id uuid;
alter table public.cashback_entries add column if not exists correlation_id uuid;

create table if not exists public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  fingerprint text not null,
  source text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  title text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  correlation_id uuid,
  occurrence_count integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, fingerprint)
);

create table if not exists public.operational_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  alert_id uuid not null references public.operational_alerts(id) on delete cascade,
  channel text not null check (channel in ('dashboard', 'webhook', 'email')),
  destination_label text not null default '',
  status text not null default 'pending' check (status in ('pending', 'delivered', 'failed', 'skipped')),
  attempt integer not null default 1,
  response_code integer,
  error_message text not null default '',
  attempted_at timestamptz not null default now(),
  delivered_at timestamptz
);

create table if not exists public.external_backup_copies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  backup_run_id uuid references public.backup_runs(id) on delete set null,
  scope text not null check (scope in ('database', 'storage', 'database_and_storage')),
  destination_label text not null,
  object_key text not null default '',
  checksum_sha256 text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  status text not null check (status in ('copied', 'verified', 'failed')),
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_test_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  backup_run_id uuid references public.backup_runs(id) on delete set null,
  environment_label text not null,
  status text not null check (status in ('started', 'passed', 'failed')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  checks jsonb not null default '{}'::jsonb,
  evidence_url text not null default '',
  notes text not null default '',
  actor_id uuid,
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists operational_alerts_queue_idx
  on public.operational_alerts (tenant_id, status, severity, last_seen_at desc);
create index if not exists alert_deliveries_pending_idx
  on public.operational_alert_deliveries (tenant_id, status, attempted_at);
create index if not exists external_backup_copies_idx
  on public.external_backup_copies (tenant_id, created_at desc);
create index if not exists recovery_test_runs_idx
  on public.recovery_test_runs (tenant_id, created_at desc);

alter table public.operational_alerts enable row level security;
alter table public.operational_alert_deliveries enable row level security;
alter table public.external_backup_copies enable row level security;
alter table public.recovery_test_runs enable row level security;

drop policy if exists "tenant operational alerts read" on public.operational_alerts;
create policy "tenant operational alerts read" on public.operational_alerts for select to authenticated
using (public.has_tenant_permission(tenant_id, 'dashboard'));
drop policy if exists "tenant operational alerts update" on public.operational_alerts;
create policy "tenant operational alerts update" on public.operational_alerts for update to authenticated
using (public.has_tenant_permission(tenant_id, 'dashboard'))
with check (public.has_tenant_permission(tenant_id, 'dashboard'));

drop policy if exists "tenant alert deliveries read" on public.operational_alert_deliveries;
create policy "tenant alert deliveries read" on public.operational_alert_deliveries for select to authenticated
using (public.has_tenant_permission(tenant_id, 'dashboard'));
drop policy if exists "tenant external backups read" on public.external_backup_copies;
create policy "tenant external backups read" on public.external_backup_copies for select to authenticated
using (public.has_tenant_permission(tenant_id, 'data'));
drop policy if exists "tenant recovery tests read" on public.recovery_test_runs;
create policy "tenant recovery tests read" on public.recovery_test_runs for select to authenticated
using (public.has_tenant_permission(tenant_id, 'data'));

revoke all on table public.operational_alerts, public.operational_alert_deliveries,
  public.external_backup_copies, public.recovery_test_runs from anon, authenticated;
grant select, update on table public.operational_alerts to authenticated;
grant select on table public.operational_alert_deliveries, public.external_backup_copies,
  public.recovery_test_runs to authenticated;

commit;
