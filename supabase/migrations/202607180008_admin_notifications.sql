begin;

-- O alerta é derivado dos dados atuais; esta tabela guarda apenas a interação
-- individual para sincronizar leitura e adiamento entre dispositivos.
create table if not exists public.admin_notification_states (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null check (char_length(notification_key) between 3 and 240),
  read_at timestamptz,
  snoozed_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id, notification_key)
);

create index if not exists admin_notification_states_user_updated
  on public.admin_notification_states (tenant_id, user_id, updated_at desc);

create or replace function public.touch_admin_notification_state()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_admin_notification_state on public.admin_notification_states;
create trigger touch_admin_notification_state
before update on public.admin_notification_states
for each row execute function public.touch_admin_notification_state();

alter table public.admin_notification_states enable row level security;
drop policy if exists "own admin notification states" on public.admin_notification_states;
create policy "own admin notification states" on public.admin_notification_states
for all to authenticated
using (
  user_id = auth.uid()
  and public.auth_has_aal2()
  and (
    public.is_platform_admin()
    or exists (
      select 1 from public.tenant_members member
      where member.tenant_id = admin_notification_states.tenant_id
        and member.user_id = auth.uid()
        and member.active = true
    )
  )
)
with check (
  user_id = auth.uid()
  and public.auth_has_aal2()
  and (
    public.is_platform_admin()
    or exists (
      select 1 from public.tenant_members member
      where member.tenant_id = admin_notification_states.tenant_id
        and member.user_id = auth.uid()
        and member.active = true
    )
  )
);

revoke all on public.admin_notification_states from anon;
grant select, insert, update, delete on public.admin_notification_states to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.admin_notification_states;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

commit;
