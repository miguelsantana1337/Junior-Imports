-- Sincroniza o estoque fisico informado em 16/07/2026.
-- A operacao usa SKUs ja validados depois da restauracao do catalogo e grava
-- movimentos de ajuste para manter o razao de estoque auditavel.

create temporary table inventory_snapshot_20260716 (
  sku text primary key,
  quantity integer not null check (quantity >= 0)
) on commit drop;

insert into inventory_snapshot_20260716 (sku, quantity) values
  ('JI-001', 0),
  ('JI-065', 40),
  ('JI-003', 6),
  ('JI-035', 0),
  ('JI-172', 2),
  ('JI-067', 10),
  ('JI-033', 0),
  ('JI-068', 1),
  ('JI-005', 0),
  ('JI-069', 0),
  ('JI-002', 0),
  ('JI-066', 2),
  ('JI-070', 0),
  ('JI-032', 1),
  ('JI-004', 0),
  ('JI-034', 0),
  ('JI-017', 2),
  ('JI-027', 1),
  ('JI-011', 2),
  ('JI-024', 3),
  ('JI-025', 1),
  ('JI-013', 1),
  ('JI-031', 3),
  ('JI-046', 4),
  ('JI-012', 2),
  ('JI-010', 6),
  ('JI-009', 3),
  ('JI-026', 3),
  ('JI-014', 8),
  ('JI-015', 1),
  ('JI-071', 3),
  ('JI-016', 11),
  ('JI-022', 19),
  ('JI-021', 14),
  ('JI-047', 0),
  ('JI-023', 3),
  ('JI-019', 10),
  ('JI-057', 0),
  ('JI-020', 3),
  ('JI-050', 0),
  ('JI-049', 7),
  ('JI-052', 7),
  ('JI-051', 5),
  ('JI-006', 2),
  ('JI-007', 0),
  ('JI-008', 6),
  ('JI-029', 1),
  ('JI-030', 1),
  ('JI-028', 1),
  ('JI-072', 17),
  ('JI-165', 2),
  ('JI-043', 2),
  ('JI-055', 3),
  ('JI-056', 2),
  ('JI-060', 2);

do $$
declare
  desired_count integer;
  matched_count integer;
  deleted_product jsonb;
  restored_product public.products%rowtype;
begin
  if exists (
    select 1
    from public.catalog_imports
    where id = 'inventory-snapshot-20260716'
  ) then
    raise notice 'O estoque inventory-snapshot-20260716 ja foi sincronizado.';
    return;
  end if;

  -- O GHK-Cu Caps (JI-043) foi excluido antes da atualizacao de estoque.
  -- Como o item foi informado novamente com saldo 2, recupera-se exatamente o
  -- cadastro anterior guardado pela auditoria, sem inventar dados comerciais.
  if not exists (select 1 from public.products where sku = 'JI-043') then
    select before_data
    into deleted_product
    from public.audit_logs
    where action = 'delete'
      and entity_type = 'products'
      and before_data->>'sku' = 'JI-043'
    order by created_at desc
    limit 1;

    if deleted_product is null then
      raise exception 'Sincronizacao interrompida: nao foi possivel recuperar o produto JI-043.';
    end if;

    insert into public.products
    select (
      jsonb_populate_record(
        null::public.products,
        deleted_product || jsonb_build_object(
          'stock', 0,
          'cost_price', 0,
          'min_stock', 5,
          'updated_at', now()
        )
      )
    ).*;

    select *
    into restored_product
    from public.products
    where sku = 'JI-043';

    insert into public.audit_logs (
      tenant_id,
      actor_email,
      action,
      entity_type,
      entity_id,
      entity_label,
      before_data,
      after_data,
      created_at
    )
    values (
      restored_product.tenant_id,
      'sincronizacao-estoque@juniorimports',
      'insert',
      'products',
      restored_product.id,
      restored_product.name,
      null,
      to_jsonb(restored_product),
      now()
    );
  end if;

  select count(*) into desired_count from inventory_snapshot_20260716;
  select count(*)
  into matched_count
  from inventory_snapshot_20260716 desired
  join public.products product on upper(product.sku) = upper(desired.sku);

  if desired_count <> 55 or matched_count <> 55 then
    raise exception 'Sincronizacao interrompida: esperados 55 SKUs e encontrados %.', matched_count;
  end if;

  if not exists (
    select 1
    from public.catalog_imports
    where id = 'restore-22865ada-20260716'
  ) then
    raise exception 'Sincronizacao interrompida: a restauracao segura do catalogo nao foi localizada.';
  end if;

  create temporary table inventory_snapshot_20260716_before on commit drop as
  select
    product.*,
    desired.quantity as desired_quantity
  from public.products product
  join inventory_snapshot_20260716 desired
    on upper(desired.sku) = upper(product.sku);

  insert into public.audit_logs (
    tenant_id,
    actor_email,
    action,
    entity_type,
    entity_id,
    entity_label,
    before_data,
    after_data,
    created_at
  )
  select
    current_product.tenant_id,
    'sincronizacao-estoque@juniorimports',
    'update',
    'products',
    current_product.id,
    current_product.name,
    to_jsonb(current_product) - 'desired_quantity',
    (to_jsonb(current_product) - 'desired_quantity') || jsonb_build_object(
      'stock', current_product.desired_quantity,
      'updated_at', now()
    ),
    now()
  from inventory_snapshot_20260716_before current_product
  where current_product.stock <> current_product.desired_quantity;

  insert into public.inventory_movements (
    tenant_id,
    id,
    product_id,
    type,
    quantity,
    balance_after,
    unit_cost,
    reference_type,
    reference_id,
    note,
    actor_email,
    created_at
  )
  select
    current_product.tenant_id,
    'inventory-snapshot-20260716-' || current_product.id,
    current_product.id,
    'adjustment',
    current_product.desired_quantity - current_product.stock,
    current_product.desired_quantity,
    current_product.cost_price,
    'inventory_snapshot',
    'inventory-snapshot-20260716',
    'Contagem fisica informada em 16/07/2026.',
    'sincronizacao-estoque@juniorimports',
    now()
  from inventory_snapshot_20260716_before current_product
  where current_product.stock <> current_product.desired_quantity
  on conflict (id) do nothing;

  update public.products product
  set
    stock = desired.quantity,
    updated_at = now()
  from inventory_snapshot_20260716 desired
  where upper(desired.sku) = upper(product.sku)
    and product.stock <> desired.quantity;

  insert into public.catalog_imports (
    tenant_id,
    id,
    kind,
    filename,
    mode,
    total_rows,
    success_rows,
    error_rows,
    actor_email,
    created_at
  )
  select
    settings.tenant_id,
    'inventory-snapshot-20260716',
    'stock',
    'estoque-fisico-informado-2026-07-16',
    'replace',
    55,
    55,
    0,
    'sincronizacao-estoque@juniorimports',
    now()
  from public.store_settings settings
  where settings.id = 'default'
  limit 1;

  raise notice 'Estoque sincronizado: 55 SKUs processados com sucesso.';
end;
$$;
