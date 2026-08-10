begin;

do $$
declare
  v_kit record;
  v_bundle_id uuid;
  v_option_count integer;
  v_available_quantity integer;
begin
  for v_kit in
    select product.tenant_id, product.id as product_id
    from public.products product
    where product.active
      and lower(trim(product.name)) = lower('Kit Degustação Tirzepatidas 15mg')
  loop
    select count(*), floor(coalesce(sum(product.stock), 0) / 4)::integer
      into v_option_count, v_available_quantity
    from public.products product
    where product.tenant_id = v_kit.tenant_id
      and product.active
      and product.id <> v_kit.product_id
      and lower(product.name) like '%15mg%'
      and lower(product.name) like '%1 ampola%';

    if v_option_count = 0 then
      continue;
    end if;

    select bundle.id into v_bundle_id
    from public.product_bundles bundle
    where bundle.tenant_id = v_kit.tenant_id
      and bundle.product_id = v_kit.product_id;

    v_bundle_id := coalesce(v_bundle_id, gen_random_uuid());

    insert into public.product_bundles (
      id, tenant_id, product_id, name, selection_label, component_count,
      allow_repetition, max_per_component, active, version, updated_at
    ) values (
      v_bundle_id, v_kit.tenant_id, v_kit.product_id,
      'Kit Degustação Tirzepatidas 15mg',
      'Escolha as 4 ampolas de 15mg',
      4, true, 4, true, 1, now()
    )
    on conflict (tenant_id, product_id) do update set
      name = excluded.name,
      selection_label = excluded.selection_label,
      component_count = excluded.component_count,
      allow_repetition = excluded.allow_repetition,
      max_per_component = excluded.max_per_component,
      active = true,
      version = public.product_bundles.version + 1,
      updated_at = now()
    returning id into v_bundle_id;

    delete from public.bundle_options option
    where option.tenant_id = v_kit.tenant_id
      and option.bundle_id = v_bundle_id;

    insert into public.bundle_options (
      tenant_id, bundle_id, product_id, max_quantity, order_index, active
    )
    select
      product.tenant_id,
      v_bundle_id,
      product.id,
      4,
      (row_number() over (order by product.name, product.id) - 1)::integer,
      true
    from public.products product
    where product.tenant_id = v_kit.tenant_id
      and product.active
      and product.id <> v_kit.product_id
      and lower(product.name) like '%15mg%'
      and lower(product.name) like '%1 ampola%';

    update public.products
    set stock = greatest(0, v_available_quantity), updated_at = now()
    where tenant_id = v_kit.tenant_id and id = v_kit.product_id;
  end loop;
end;
$$;

commit;
