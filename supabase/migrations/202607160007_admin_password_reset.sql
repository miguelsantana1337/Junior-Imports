begin;

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

update public.profiles profile
set must_change_password = true
from auth.users auth_user
where auth_user.id = profile.id
  and auth_user.raw_user_meta_data->>'must_change_password' = 'true';

create or replace function public.is_platform_admin()
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
      and must_change_password = false
      and is_platform_admin = true
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
      and exists(
        select 1
        from public.profiles
        where id = auth.uid()
          and active = true
          and must_change_password = false
      )
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
      and must_change_password = false
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
    where id = auth.uid()
      and active = true
      and must_change_password = false
      and role = 'owner'
  );
$$;

notify pgrst, 'reload schema';

commit;
