begin;

alter table public.order_items
  add column if not exists is_component boolean not null default false,
  add column if not exists parent_product_id text references public.products(id) on delete set null;

create table if not exists public.product_bundles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  name text not null,
  selection_label text not null default 'Escolha os componentes',
  component_count integer not null check (component_count between 1 and 50),
  allow_repetition boolean not null default false,
  max_per_component integer not null default 1 check (max_per_component between 1 and 50),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create table if not exists public.bundle_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  bundle_id uuid not null references public.product_bundles(id) on delete cascade,
  product_id text not null references public.products(id) on delete restrict,
  max_quantity integer not null default 1 check (max_quantity between 1 and 50),
  order_index integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, bundle_id, product_id)
);

create table if not exists public.order_item_components (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  bundle_product_id text not null references public.products(id) on delete restrict,
  component_product_id text not null references public.products(id) on delete restrict,
  component_name text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12,2) not null default 0 check (unit_cost >= 0),
  bundle_version integer not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, order_id, bundle_product_id, component_product_id)
);

create index if not exists product_bundles_public_idx
  on public.product_bundles (tenant_id, active, product_id);
create index if not exists bundle_options_bundle_idx
  on public.bundle_options (tenant_id, bundle_id, order_index);
create index if not exists order_item_components_order_idx
  on public.order_item_components (tenant_id, order_id);

alter table public.product_bundles enable row level security;
alter table public.bundle_options enable row level security;
alter table public.order_item_components enable row level security;

drop policy if exists "public active bundles read" on public.product_bundles;
create policy "public active bundles read" on public.product_bundles for select to anon, authenticated
using (
  active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
  or public.has_tenant_permission(tenant_id, 'catalog')
);
drop policy if exists "tenant bundles manage" on public.product_bundles;
create policy "tenant bundles manage" on public.product_bundles for all to authenticated
using (public.has_tenant_permission(tenant_id, 'catalog'))
with check (public.has_tenant_permission(tenant_id, 'catalog'));

drop policy if exists "public active bundle options read" on public.bundle_options;
create policy "public active bundle options read" on public.bundle_options for select to anon, authenticated
using (
  active and exists (
    select 1 from public.product_bundles bundle
    where bundle.id = bundle_options.bundle_id and bundle.tenant_id = bundle_options.tenant_id
      and bundle.active and (bundle.starts_at is null or bundle.starts_at <= now())
      and (bundle.ends_at is null or bundle.ends_at >= now())
  )
  or public.has_tenant_permission(tenant_id, 'catalog')
);
drop policy if exists "tenant bundle options manage" on public.bundle_options;
create policy "tenant bundle options manage" on public.bundle_options for all to authenticated
using (public.has_tenant_permission(tenant_id, 'catalog'))
with check (public.has_tenant_permission(tenant_id, 'catalog'));

drop policy if exists "tenant order components read" on public.order_item_components;
create policy "tenant order components read" on public.order_item_components for select to authenticated
using (public.has_tenant_permission(tenant_id, 'orders'));

revoke all on table public.product_bundles, public.bundle_options,
  public.order_item_components from anon, authenticated;
grant select on table public.product_bundles, public.bundle_options to anon, authenticated;
grant insert, update, delete on table public.product_bundles, public.bundle_options to authenticated;
grant select on table public.order_item_components to authenticated;

create or replace function public.save_product_bundle(
  p_tenant_id uuid,
  p_bundle_id uuid,
  p_product_id text,
  p_name text,
  p_selection_label text,
  p_component_count integer,
  p_allow_repetition boolean,
  p_max_per_component integer,
  p_active boolean,
  p_option_product_ids jsonb,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version integer := 1;
  v_stock integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if jsonb_typeof(p_option_product_ids) <> 'array' or jsonb_array_length(p_option_product_ids) = 0 then
    raise exception 'Selecione ao menos um componente';
  end if;
  if exists (
    select 1 from public.product_bundles
    where tenant_id = p_tenant_id and product_id = p_product_id and id <> p_bundle_id
  ) then raise exception 'Este produto já possui um kit configurado'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(p_option_product_ids) option_id
    left join public.products product on product.tenant_id = p_tenant_id and product.id = option_id and product.active
    where product.id is null or product.id = p_product_id
  ) then raise exception 'Há componentes inválidos ou inativos'; end if;

  select coalesce(version + 1, 1) into v_version from public.product_bundles
  where tenant_id = p_tenant_id and id = p_bundle_id;
  v_version := coalesce(v_version, 1);

  insert into public.product_bundles (
    id, tenant_id, product_id, name, selection_label, component_count,
    allow_repetition, max_per_component, active, version, created_by, updated_at
  ) values (
    p_bundle_id, p_tenant_id, p_product_id, trim(p_name), trim(p_selection_label),
    p_component_count, p_allow_repetition, p_max_per_component, p_active,
    v_version, p_actor_id, now()
  ) on conflict (id) do update set
    product_id = excluded.product_id,
    name = excluded.name,
    selection_label = excluded.selection_label,
    component_count = excluded.component_count,
    allow_repetition = excluded.allow_repetition,
    max_per_component = excluded.max_per_component,
    active = excluded.active,
    version = excluded.version,
    updated_at = now();

  delete from public.bundle_options where tenant_id = p_tenant_id and bundle_id = p_bundle_id;
  insert into public.bundle_options (tenant_id, bundle_id, product_id, max_quantity, order_index, active)
  select p_tenant_id, p_bundle_id, option_id, p_max_per_component, ordinality - 1, true
  from jsonb_array_elements_text(p_option_product_ids) with ordinality as option(option_id, ordinality)
  on conflict (tenant_id, bundle_id, product_id) do update set
    max_quantity = excluded.max_quantity, order_index = excluded.order_index, active = true;

  select floor(coalesce(sum(product.stock), 0) / p_component_count)::integer into v_stock
  from public.products product
  where product.tenant_id = p_tenant_id and product.id in (
    select value from jsonb_array_elements_text(p_option_product_ids)
  ) and product.active;
  update public.products set stock = greatest(0, v_stock), updated_at = now()
  where tenant_id = p_tenant_id and id = p_product_id;

  return jsonb_build_object('id', p_bundle_id, 'version', v_version, 'available_quantity', greatest(0, v_stock));
end;
$$;

revoke all on function public.save_product_bundle(uuid, uuid, text, text, text, integer, boolean, integer, boolean, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.save_product_bundle(uuid, uuid, text, text, text, integer, boolean, integer, boolean, jsonb, uuid) to service_role;

create or replace function public.create_tenant_order_with_bundles_secure(
  p_tenant_id uuid,
  p_customer jsonb,
  p_items jsonb,
  p_payment text,
  p_coupon_code text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_fingerprint_hash text default '',
  p_source text default 'storefront',
  p_reservation_minutes integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_base_items jsonb := '[]'::jsonb;
  v_bundle public.product_bundles%rowtype;
  v_component text;
  v_component_row record;
  v_order jsonb;
  v_order_id text;
  v_quantity integer;
  v_selected_count integer;
  v_available integer;
  v_needed integer;
  v_bundle_stock integer;
  v_virtual_reserved integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Carrinho inválido'; end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_base_items := v_base_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_item->>'product_id', 'quantity', (v_item->>'quantity')::integer
    ));
    select * into v_bundle from public.product_bundles
    where tenant_id = p_tenant_id and product_id = v_item->>'product_id'
      and active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now());
    if found then
      if jsonb_typeof(v_item->'components') <> 'array' then raise exception 'Escolha os componentes do kit'; end if;
      v_selected_count := jsonb_array_length(v_item->'components');
      if v_selected_count <> v_bundle.component_count then
        raise exception 'O kit exige exatamente % componentes', v_bundle.component_count;
      end if;
      if not v_bundle.allow_repetition and (
        select count(distinct value #>> '{}') from jsonb_array_elements(v_item->'components')
      ) <> v_selected_count then raise exception 'Este kit não permite repetir componentes'; end if;

      v_quantity := (v_item->>'quantity')::integer;
      for v_component_row in
        select value #>> '{}' as product_id, count(*)::integer as selected_quantity
        from jsonb_array_elements(v_item->'components') group by value #>> '{}'
      loop
        if not exists (
          select 1 from public.bundle_options option
          where option.tenant_id = p_tenant_id and option.bundle_id = v_bundle.id
            and option.product_id = v_component_row.product_id and option.active
            and v_component_row.selected_quantity <= least(option.max_quantity, v_bundle.max_per_component)
        ) then raise exception 'Componente inválido ou acima do limite do kit'; end if;

        select greatest(0, product.stock - coalesce((
          select sum(reservation.quantity) from public.order_stock_reservations reservation
          where reservation.tenant_id = p_tenant_id and reservation.product_id = product.id
            and reservation.status = 'active' and reservation.expires_at > now()
        ), 0))::integer into v_available
        from public.products product
        where product.tenant_id = p_tenant_id and product.id = v_component_row.product_id
          and product.active for update;
        v_needed := v_component_row.selected_quantity * v_quantity;
        if v_available is null or v_available < v_needed then raise exception 'Um componente do kit ficou sem estoque'; end if;
      end loop;

      select floor(coalesce(sum(greatest(0, product.stock - coalesce(reserved.quantity, 0))), 0) / v_bundle.component_count)::integer
      into v_bundle_stock
      from public.bundle_options option
      join public.products product on product.tenant_id = option.tenant_id and product.id = option.product_id and product.active
      left join lateral (
        select sum(reservation.quantity) as quantity from public.order_stock_reservations reservation
        where reservation.tenant_id = option.tenant_id and reservation.product_id = option.product_id
          and reservation.status = 'active' and reservation.expires_at > now()
      ) reserved on true
      where option.tenant_id = p_tenant_id and option.bundle_id = v_bundle.id and option.active;
      select coalesce(sum(quantity), 0)::integer into v_virtual_reserved
      from public.order_stock_reservations
      where tenant_id = p_tenant_id and product_id = v_bundle.product_id
        and status = 'active' and expires_at > now();
      update public.products set stock = greatest(0, v_bundle_stock) + v_virtual_reserved, updated_at = now()
      where tenant_id = p_tenant_id and id = v_bundle.product_id;
    elsif v_item ? 'components' and jsonb_array_length(coalesce(v_item->'components', '[]'::jsonb)) > 0 then
      raise exception 'Este produto não aceita componentes';
    end if;
  end loop;

  v_order := public.create_tenant_order_secure(
    p_tenant_id, p_customer, v_base_items, p_payment, p_coupon_code,
    p_idempotency_key, p_request_hash, p_fingerprint_hash, p_source, p_reservation_minutes
  );
  if coalesce((v_order->>'idempotent_replay')::boolean, false) then return v_order; end if;
  v_order_id := v_order->>'id';

  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_bundle from public.product_bundles
    where tenant_id = p_tenant_id and product_id = v_item->>'product_id' and active;
    if not found then continue; end if;
    v_quantity := (v_item->>'quantity')::integer;

    delete from public.order_stock_reservations
    where tenant_id = p_tenant_id and order_id = v_order_id and product_id = v_bundle.product_id;
    update public.order_items set unit_cost = 0
    where tenant_id = p_tenant_id and order_id = v_order_id and product_id = v_bundle.product_id and not is_component;

    for v_component_row in
      select value #>> '{}' as product_id, count(*)::integer * v_quantity as selected_quantity
      from jsonb_array_elements(v_item->'components') group by value #>> '{}'
    loop
      insert into public.order_item_components (
        tenant_id, order_id, bundle_product_id, component_product_id,
        component_name, quantity, unit_cost, bundle_version
      )
      select p_tenant_id, v_order_id, v_bundle.product_id, product.id,
        product.name, v_component_row.selected_quantity, product.cost_price, v_bundle.version
      from public.products product
      where product.tenant_id = p_tenant_id and product.id = v_component_row.product_id;

      insert into public.order_items (
        tenant_id, order_id, product_id, product_name, quantity,
        unit_price, unit_cost, unit_cashback, is_component, parent_product_id
      )
      select p_tenant_id, v_order_id, product.id, product.name,
        v_component_row.selected_quantity, 0, product.cost_price, 0, true, v_bundle.product_id
      from public.products product
      where product.tenant_id = p_tenant_id and product.id = v_component_row.product_id;

      insert into public.order_stock_reservations (
        tenant_id, order_id, product_id, quantity, status, expires_at
      )
      select p_tenant_id, v_order_id, v_component_row.product_id,
        v_component_row.selected_quantity, 'active', reservation_expires_at
      from public.orders where tenant_id = p_tenant_id and id = v_order_id
      on conflict (tenant_id, order_id, product_id) do update set
        quantity = public.order_stock_reservations.quantity + excluded.quantity,
        status = 'active', expires_at = excluded.expires_at, updated_at = now();
    end loop;
  end loop;

  return v_order;
end;
$$;

revoke all on function public.create_tenant_order_with_bundles_secure(
  uuid, jsonb, jsonb, text, text, uuid, text, text, text, integer
) from public, anon, authenticated;
grant execute on function public.create_tenant_order_with_bundles_secure(
  uuid, jsonb, jsonb, text, text, uuid, text, text, text, integer
) to service_role;

commit;
