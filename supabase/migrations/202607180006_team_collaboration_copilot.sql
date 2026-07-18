-- Lote 6: colaboração de equipe, presença, edição concorrente e Copiloto somente leitura.

alter table public.profiles drop constraint if exists profiles_permissions_check;
alter table public.profiles add constraint profiles_permissions_check check (
  permissions <@ array[
    'dashboard', 'audit', 'customers', 'crm', 'orders', 'catalog', 'inventory',
    'purchasing', 'finance', 'reports', 'collaboration', 'copilot', 'store',
    'marketing', 'settings', 'data', 'users'
  ]::text[]
);

alter table public.tenant_members drop constraint if exists tenant_members_permissions_check;
alter table public.tenant_members add constraint tenant_members_permissions_check check (
  permissions <@ array[
    'dashboard', 'audit', 'customers', 'crm', 'orders', 'catalog', 'inventory',
    'purchasing', 'finance', 'reports', 'collaboration', 'copilot', 'store',
    'marketing', 'settings', 'data', 'users'
  ]::text[]
);

update public.profiles
set permissions = permissions || array['collaboration', 'copilot']::text[]
where active = true
  and role in ('owner', 'manager', 'admin')
  and not (permissions @> array['collaboration', 'copilot']::text[]);

update public.tenant_members
set permissions = permissions || array['collaboration', 'copilot']::text[]
where active = true
  and role in ('owner', 'manager')
  and not (permissions @> array['collaboration', 'copilot']::text[]);

update public.profiles
set permissions = array_append(permissions, 'copilot')
where active = true and not ('copilot' = any(permissions));

update public.tenant_members
set permissions = array_append(permissions, 'copilot')
where active = true and not ('copilot' = any(permissions));

create table if not exists public.collaboration_threads (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  title text not null check (char_length(trim(title)) between 2 and 140),
  entity_type text not null default 'general' check (entity_type in ('general', 'product', 'customer', 'order', 'publication', 'report', 'purchase')),
  entity_id text not null default '',
  entity_label text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'archived')),
  priority text not null default 'normal' check (priority in ('normal', 'high', 'urgent')),
  created_by uuid references auth.users(id) on delete set null,
  created_by_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collaboration_comments (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  thread_id text not null references public.collaboration_threads(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  mentions text[] not null default '{}',
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.approval_requests (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  thread_id text references public.collaboration_threads(id) on delete set null,
  entity_type text not null check (entity_type in ('product', 'customer', 'order', 'publication', 'report', 'purchase')),
  entity_id text not null default '',
  entity_label text not null,
  request_note text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  requested_by uuid references auth.users(id) on delete set null,
  requested_by_email text not null default '',
  reviewer_email text not null default '',
  decision_note text not null default '',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.team_presence (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  route text not null default '/admin',
  entity_type text not null default '',
  entity_id text not null default '',
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists public.entity_edit_locks (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  route text not null default '',
  lease_expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, entity_type, entity_id)
);

create table if not exists public.copilot_usage (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'local' check (mode in ('local', 'openai')),
  model text not null default '',
  route text not null default '/admin',
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  status text not null default 'completed' check (status in ('completed', 'blocked', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists collaboration_threads_tenant_updated on public.collaboration_threads (tenant_id, status, updated_at desc);
create index if not exists collaboration_comments_thread_created on public.collaboration_comments (tenant_id, thread_id, created_at);
create index if not exists collaboration_comments_mentions on public.collaboration_comments using gin (mentions);
create index if not exists approval_requests_tenant_status on public.approval_requests (tenant_id, status, updated_at desc);
create index if not exists team_presence_recent on public.team_presence (tenant_id, last_seen_at desc);
create index if not exists entity_edit_locks_expiry on public.entity_edit_locks (tenant_id, lease_expires_at);
create index if not exists copilot_usage_tenant_created on public.copilot_usage (tenant_id, created_at desc);

create or replace function public.touch_collaboration_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_collaboration_thread on public.collaboration_threads;
create trigger touch_collaboration_thread before update on public.collaboration_threads
for each row execute function public.touch_collaboration_updated_at();

drop trigger if exists touch_approval_request on public.approval_requests;
create trigger touch_approval_request before update on public.approval_requests
for each row execute function public.touch_collaboration_updated_at();

create or replace function public.heartbeat_team_presence(
  p_tenant_id uuid,
  p_email text,
  p_full_name text,
  p_route text,
  p_entity_type text default '',
  p_entity_id text default ''
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not (
    public.has_tenant_permission(p_tenant_id, 'collaboration') or
    public.has_tenant_permission(p_tenant_id, 'copilot')
  ) then raise exception 'Acesso negado'; end if;

  insert into public.team_presence (tenant_id, user_id, email, full_name, route, entity_type, entity_id, last_seen_at, updated_at)
  values (p_tenant_id, auth.uid(), left(p_email, 320), left(p_full_name, 160), left(p_route, 500), left(p_entity_type, 80), left(p_entity_id, 200), now(), now())
  on conflict (tenant_id, user_id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    route = excluded.route,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    last_seen_at = now(),
    updated_at = now();
end;
$$;

create or replace function public.acquire_entity_edit_lock(
  p_tenant_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_email text,
  p_full_name text,
  p_route text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  current_lock public.entity_edit_locks%rowtype;
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'collaboration') then
    raise exception 'Acesso negado';
  end if;

  delete from public.entity_edit_locks where lease_expires_at < now();
  select * into current_lock from public.entity_edit_locks
  where tenant_id = p_tenant_id and entity_type = p_entity_type and entity_id = p_entity_id
  for update;

  if found and current_lock.user_id <> auth.uid() then
    return jsonb_build_object('acquired', false, 'email', current_lock.email, 'fullName', current_lock.full_name, 'expiresAt', current_lock.lease_expires_at);
  end if;

  insert into public.entity_edit_locks (tenant_id, entity_type, entity_id, user_id, email, full_name, route, lease_expires_at, updated_at)
  values (p_tenant_id, left(p_entity_type, 80), left(p_entity_id, 200), auth.uid(), left(p_email, 320), left(p_full_name, 160), left(p_route, 500), now() + interval '75 seconds', now())
  on conflict (tenant_id, entity_type, entity_id) do update set
    user_id = auth.uid(), email = excluded.email, full_name = excluded.full_name,
    route = excluded.route, lease_expires_at = excluded.lease_expires_at, updated_at = now();

  return jsonb_build_object('acquired', true, 'email', p_email, 'fullName', p_full_name, 'expiresAt', now() + interval '75 seconds');
end;
$$;

create or replace function public.release_entity_edit_lock(p_tenant_id uuid, p_entity_type text, p_entity_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.entity_edit_locks
  where tenant_id = p_tenant_id and entity_type = p_entity_type and entity_id = p_entity_id and user_id = auth.uid();
end;
$$;

alter table public.collaboration_threads enable row level security;
alter table public.collaboration_comments enable row level security;
alter table public.approval_requests enable row level security;
alter table public.team_presence enable row level security;
alter table public.entity_edit_locks enable row level security;
alter table public.copilot_usage enable row level security;

drop policy if exists "tenant collaboration threads manage" on public.collaboration_threads;
create policy "tenant collaboration threads manage" on public.collaboration_threads for all to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'))
with check (public.has_tenant_permission(tenant_id, 'collaboration'));

drop policy if exists "tenant collaboration comments manage" on public.collaboration_comments;
create policy "tenant collaboration comments manage" on public.collaboration_comments for all to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'))
with check (public.has_tenant_permission(tenant_id, 'collaboration'));

drop policy if exists "tenant approvals manage" on public.approval_requests;
create policy "tenant approvals manage" on public.approval_requests for all to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'))
with check (public.has_tenant_permission(tenant_id, 'collaboration'));

drop policy if exists "tenant presence read" on public.team_presence;
create policy "tenant presence read" on public.team_presence for select to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'));

drop policy if exists "tenant edit locks read" on public.entity_edit_locks;
create policy "tenant edit locks read" on public.entity_edit_locks for select to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'));

drop policy if exists "own copilot usage" on public.copilot_usage;
create policy "own copilot usage" on public.copilot_usage for all to authenticated
using (user_id = auth.uid() and public.has_tenant_permission(tenant_id, 'copilot'))
with check (user_id = auth.uid() and public.has_tenant_permission(tenant_id, 'copilot'));

grant select, insert, update, delete on public.collaboration_threads, public.collaboration_comments, public.approval_requests to authenticated;
grant select on public.team_presence, public.entity_edit_locks to authenticated;
grant select, insert on public.copilot_usage to authenticated;
grant execute on function public.heartbeat_team_presence(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.acquire_entity_edit_lock(uuid, text, text, text, text, text) to authenticated;
grant execute on function public.release_entity_edit_lock(uuid, text, text) to authenticated;

revoke all on public.collaboration_threads, public.collaboration_comments, public.approval_requests, public.team_presence, public.entity_edit_locks, public.copilot_usage from anon;

drop trigger if exists admin_audit_change on public.collaboration_threads;
create trigger admin_audit_change after insert or update or delete on public.collaboration_threads
for each row execute function public.capture_admin_audit();

drop trigger if exists admin_audit_change on public.collaboration_comments;
create trigger admin_audit_change after insert or update or delete on public.collaboration_comments
for each row execute function public.capture_admin_audit();

drop trigger if exists admin_audit_change on public.approval_requests;
create trigger admin_audit_change after insert or update or delete on public.approval_requests
for each row execute function public.capture_admin_audit();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.collaboration_threads; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.collaboration_comments; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.approval_requests; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.team_presence; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.entity_edit_locks; exception when duplicate_object then null; end;
  end if;
end $$;
