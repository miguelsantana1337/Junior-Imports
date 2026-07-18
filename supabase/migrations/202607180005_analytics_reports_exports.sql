-- Lote 5: inteligência de estoque, relatórios salvos e histórico de exportações.

alter table public.profiles drop constraint if exists profiles_permissions_check;
alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array[
    'dashboard', 'audit', 'customers', 'crm', 'orders', 'catalog', 'inventory',
    'purchasing', 'finance', 'reports', 'store', 'marketing', 'settings', 'data', 'users'
  ]::text[]
);

alter table public.tenant_members drop constraint if exists tenant_members_permissions_check;
alter table public.tenant_members add constraint tenant_members_permissions_check check (
  permissions <@ array[
    'dashboard', 'audit', 'customers', 'crm', 'orders', 'catalog', 'inventory',
    'purchasing', 'finance', 'reports', 'store', 'marketing', 'settings', 'data', 'users'
  ]::text[]
);

update public.profiles
set permissions = array_append(permissions, 'reports')
where active = true and role in ('owner', 'manager', 'admin') and not ('reports' = any(permissions));

update public.tenant_members
set permissions = array_append(permissions, 'reports')
where active = true and role in ('owner', 'manager') and not ('reports' = any(permissions));

create table if not exists public.saved_reports (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  name text not null check (char_length(trim(name)) between 2 and 120),
  report_type text not null check (report_type in ('sales', 'finance', 'inventory', 'customers', 'cashback', 'purchases')),
  date_from date not null,
  date_to date not null,
  compare_previous boolean not null default true,
  filters jsonb not null default '{}'::jsonb check (jsonb_typeof(filters) = 'object'),
  shared boolean not null default false,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_reports_period_check check (date_to >= date_from)
);

create table if not exists public.export_runs (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  report_id text not null default '',
  report_name text not null,
  format text not null check (format in ('csv', 'xlsx', 'pdf')),
  row_count integer not null default 0 check (row_count >= 0),
  status text not null check (status in ('completed', 'failed')),
  file_name text not null default '',
  error_message text not null default '',
  actor_email text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists saved_reports_tenant_updated on public.saved_reports (tenant_id, updated_at desc);
create index if not exists export_runs_tenant_created on public.export_runs (tenant_id, created_at desc);

alter table public.saved_reports enable row level security;
alter table public.export_runs enable row level security;

drop policy if exists "tenant saved reports manage" on public.saved_reports;
create policy "tenant saved reports manage" on public.saved_reports for all to authenticated
using (public.has_tenant_permission(tenant_id, 'reports'))
with check (public.has_tenant_permission(tenant_id, 'reports'));

drop policy if exists "tenant export runs manage" on public.export_runs;
create policy "tenant export runs manage" on public.export_runs for all to authenticated
using (public.has_tenant_permission(tenant_id, 'reports'))
with check (public.has_tenant_permission(tenant_id, 'reports'));

grant select, insert, update, delete on public.saved_reports to authenticated;
grant select, insert, update, delete on public.export_runs to authenticated;
revoke all on public.saved_reports from anon;
revoke all on public.export_runs from anon;

drop trigger if exists admin_audit_change on public.saved_reports;
create trigger admin_audit_change after insert or update or delete on public.saved_reports
for each row execute function public.capture_admin_audit();

drop trigger if exists admin_audit_change on public.export_runs;
create trigger admin_audit_change after insert or update or delete on public.export_runs
for each row execute function public.capture_admin_audit();
