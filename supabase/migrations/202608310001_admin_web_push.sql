begin;

create table if not exists public.admin_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 16 and 2048),
  p256dh text not null check (char_length(p256dh) between 16 and 512),
  auth_secret text not null check (char_length(auth_secret) between 8 and 256),
  categories text[] not null default array[
    'inventory', 'orders', 'crm', 'purchasing', 'collaboration',
    'cashback', 'marketing', 'security', 'system'
  ]::text[],
  user_agent text not null default '' check (char_length(user_agent) <= 512),
  device_label text not null default '' check (char_length(device_label) <= 120),
  active boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_count integer not null default 0 check (failure_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, endpoint),
  check (
    categories <@ array[
      'inventory', 'orders', 'crm', 'purchasing', 'collaboration',
      'cashback', 'marketing', 'security', 'system'
    ]::text[]
  )
);

create index if not exists admin_push_subscriptions_tenant_active
  on public.admin_push_subscriptions (tenant_id, active, updated_at desc);
create index if not exists admin_push_subscriptions_categories
  on public.admin_push_subscriptions using gin (categories);

create table if not exists public.admin_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid not null references public.admin_push_subscriptions(id) on delete cascade,
  notification_key text not null check (char_length(notification_key) between 3 and 240),
  category text not null check (category = any (array[
    'inventory', 'orders', 'crm', 'purchasing', 'collaboration',
    'cashback', 'marketing', 'security', 'system'
  ]::text[])),
  status text not null default 'queued' check (status = any (array['queued', 'sent', 'failed', 'expired']::text[])),
  response_code integer,
  error_message text not null default '' check (char_length(error_message) <= 500),
  created_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (subscription_id, notification_key)
);

create index if not exists admin_push_deliveries_tenant_created
  on public.admin_push_deliveries (tenant_id, created_at desc);
create index if not exists admin_push_deliveries_user_created
  on public.admin_push_deliveries (user_id, created_at desc);

create or replace function public.touch_admin_push_subscription()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_admin_push_subscription on public.admin_push_subscriptions;
create trigger touch_admin_push_subscription
before update on public.admin_push_subscriptions
for each row execute function public.touch_admin_push_subscription();

alter table public.admin_push_subscriptions enable row level security;
alter table public.admin_push_deliveries enable row level security;

drop policy if exists "own admin push subscriptions" on public.admin_push_subscriptions;
create policy "own admin push subscriptions" on public.admin_push_subscriptions
for all to authenticated
using (
  user_id = auth.uid()
  and public.auth_has_aal2()
  and (
    public.is_platform_admin()
    or exists (
      select 1 from public.tenant_members member
      where member.tenant_id = admin_push_subscriptions.tenant_id
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
      where member.tenant_id = admin_push_subscriptions.tenant_id
        and member.user_id = auth.uid()
        and member.active = true
    )
  )
);

drop policy if exists "own admin push deliveries" on public.admin_push_deliveries;
create policy "own admin push deliveries" on public.admin_push_deliveries
for select to authenticated
using (
  user_id = auth.uid()
  and public.auth_has_aal2()
  and (
    public.is_platform_admin()
    or exists (
      select 1 from public.tenant_members member
      where member.tenant_id = admin_push_deliveries.tenant_id
        and member.user_id = auth.uid()
        and member.active = true
    )
  )
);

revoke all on public.admin_push_subscriptions from anon;
revoke all on public.admin_push_deliveries from anon;
grant select, insert, update, delete on public.admin_push_subscriptions to authenticated;
grant select on public.admin_push_deliveries to authenticated;
grant all on public.admin_push_subscriptions to service_role;
grant all on public.admin_push_deliveries to service_role;

commit;
