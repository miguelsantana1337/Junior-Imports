begin;

create table if not exists public.backup_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  status text not null default 'completed' check (status in ('started', 'completed', 'verified', 'failed')),
  backup_type text not null default 'logical_encrypted' check (backup_type in ('logical_encrypted', 'physical', 'pitr')),
  storage_label text not null default '',
  file_sha256 text not null default '',
  key_fingerprint text not null default '',
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  table_count integer not null default 0 check (table_count >= 0),
  row_count integer not null default 0 check (row_count >= 0),
  media_count integer not null default 0 check (media_count >= 0),
  actor_email text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists backup_runs_tenant_created
  on public.backup_runs (tenant_id, created_at desc);

alter table public.backup_runs enable row level security;

drop policy if exists "tenant backup runs read" on public.backup_runs;
create policy "tenant backup runs read" on public.backup_runs
for select to authenticated
using (public.has_tenant_permission(tenant_id, 'data'));

revoke all on table public.backup_runs from anon, authenticated;
grant select on table public.backup_runs to authenticated;

commit;
