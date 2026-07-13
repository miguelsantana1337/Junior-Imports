alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add column if not exists full_name text not null default '';
alter table public.profiles add column if not exists email text not null default '';
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists permissions text[] not null default array['dashboard']::text[];

update public.profiles p
set email = coalesce(u.email, p.email),
    full_name = coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(p.full_name, ''), split_part(coalesce(u.email, ''), '@', 1))
from auth.users u
where u.id = p.id;

update public.profiles
set role = 'owner',
    permissions = array['dashboard', 'orders', 'catalog', 'store', 'marketing', 'settings', 'data', 'users']::text[]
where role = 'admin';

alter table public.profiles add constraint profiles_role_check check (role in ('owner', 'manager', 'editor', 'support', 'viewer'));
alter table public.profiles add constraint profiles_permissions_check check (permissions <@ array['dashboard', 'orders', 'catalog', 'store', 'marketing', 'settings', 'data', 'users']::text[]);

create or replace function public.has_admin_permission(requested_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.profiles
    where id = auth.uid()
      and active = true
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
  select exists(select 1 from public.profiles where id = auth.uid() and active = true and role = 'owner');
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, permissions, active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.email, ''),
    'viewer',
    array['dashboard']::text[],
    true
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    email = excluded.email;
  return new;
end;
$$;

grant execute on function public.has_admin_permission(text) to authenticated;

drop policy if exists "profiles own read" on public.profiles;
drop policy if exists "admin profiles" on public.profiles;
create policy "staff profiles read" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_admin_permission('users'));

create policy "staff orders" on public.orders for all to authenticated
using (public.has_admin_permission('orders')) with check (public.has_admin_permission('orders'));
create policy "staff order items" on public.order_items for all to authenticated
using (public.has_admin_permission('orders')) with check (public.has_admin_permission('orders'));

create policy "staff categories" on public.categories for all to authenticated
using (public.has_admin_permission('catalog')) with check (public.has_admin_permission('catalog'));
create policy "staff products" on public.products for all to authenticated
using (public.has_admin_permission('catalog')) with check (public.has_admin_permission('catalog'));

create policy "staff banners" on public.banners for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));
create policy "staff home sections" on public.home_sections for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));
create policy "staff trust items" on public.trust_items for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));
create policy "staff benefits" on public.benefits for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));
create policy "staff faqs" on public.faqs for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));
create policy "staff pages" on public.store_pages for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));
create policy "staff page blocks" on public.page_blocks for all to authenticated
using (public.has_admin_permission('store')) with check (public.has_admin_permission('store'));

create policy "staff coupons" on public.coupons for all to authenticated
using (public.has_admin_permission('marketing')) with check (public.has_admin_permission('marketing'));
create policy "staff message automations" on public.message_automations for all to authenticated
using (public.has_admin_permission('marketing')) with check (public.has_admin_permission('marketing'));
create policy "staff message logs" on public.message_logs for all to authenticated
using (public.has_admin_permission('marketing') or public.has_admin_permission('orders'))
with check (public.has_admin_permission('marketing') or public.has_admin_permission('orders'));

create policy "staff settings" on public.store_settings for all to authenticated
using (public.has_admin_permission('settings')) with check (public.has_admin_permission('settings'));

create policy "staff product media insert" on storage.objects for insert to authenticated
with check (bucket_id = 'product-media' and public.has_admin_permission('catalog'));
create policy "staff product media update" on storage.objects for update to authenticated
using (bucket_id = 'product-media' and public.has_admin_permission('catalog'))
with check (bucket_id = 'product-media' and public.has_admin_permission('catalog'));
create policy "staff product media delete" on storage.objects for delete to authenticated
using (bucket_id = 'product-media' and public.has_admin_permission('catalog'));

create policy "staff store media insert" on storage.objects for insert to authenticated
with check (bucket_id in ('banner-media', 'site-media') and public.has_admin_permission('store'));
create policy "staff store media update" on storage.objects for update to authenticated
using (bucket_id in ('banner-media', 'site-media') and public.has_admin_permission('store'))
with check (bucket_id in ('banner-media', 'site-media') and public.has_admin_permission('store'));
create policy "staff store media delete" on storage.objects for delete to authenticated
using (bucket_id in ('banner-media', 'site-media') and public.has_admin_permission('store'));
