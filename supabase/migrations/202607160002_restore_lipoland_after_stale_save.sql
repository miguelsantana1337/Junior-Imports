-- Corrige um salvamento isolado feito por uma tela antiga logo apos a
-- restauracao do lote 22865ada. Os demais 47 produtos permaneceram corretos.

do $$
declare
  source_before jsonb;
  stale_after jsonb;
  product_row public.products%rowtype;
begin
  if exists (
    select 1
    from public.catalog_imports
    where id = 'restore-lipoland-stale-save-20260716'
  ) then
    raise notice 'A correcao restore-lipoland-stale-save-20260716 ja foi aplicada.';
    return;
  end if;

  select before_data, after_data
  into source_before, stale_after
  from public.audit_logs
  where actor_email = 'junioraraujo66361@gmail.com'
    and action = 'update'
    and entity_type = 'products'
    and entity_id = 'lipoland15'
    and created_at = '2026-07-16 00:26:13.744103+00'::timestamptz
  limit 1;

  if source_before is null or stale_after is null then
    raise notice 'Historico do Lipoland nao existe neste ambiente; correcao ignorada.';
    return;
  end if;

  select *
  into product_row
  from public.products
  where id = 'lipoland15'
  for update;

  if not found then
    raise exception 'Correcao interrompida: produto lipoland15 nao encontrado.';
  end if;

  if product_row.name is distinct from stale_after->>'name'
     or product_row.brand is distinct from stale_after->>'brand'
     or product_row.stock is distinct from (stale_after->>'stock')::integer
     or product_row.category_id is distinct from stale_after->>'category_id'
     or product_row.active is distinct from (stale_after->>'active')::boolean
     or product_row.featured is distinct from (stale_after->>'featured')::boolean then
    raise exception 'Correcao interrompida: Lipoland recebeu outra alteracao depois do salvamento antigo.';
  end if;

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
    product_row.tenant_id,
    'restauracao-sistema@juniorimports',
    'update',
    'products',
    product_row.id,
    source_before->>'name',
    to_jsonb(product_row),
    to_jsonb(product_row) || jsonb_build_object(
      'name', source_before->>'name',
      'brand', source_before->>'brand',
      'stock', (source_before->>'stock')::integer,
      'category_id', source_before->>'category_id',
      'active', (source_before->>'active')::boolean,
      'featured', (source_before->>'featured')::boolean,
      'updated_at', now()
    ),
    now()
  );

  update public.products
  set
    name = source_before->>'name',
    brand = source_before->>'brand',
    stock = (source_before->>'stock')::integer,
    category_id = source_before->>'category_id',
    active = (source_before->>'active')::boolean,
    featured = (source_before->>'featured')::boolean,
    updated_at = now()
  where id = product_row.id;

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
  values (
    product_row.tenant_id,
    'restore-lipoland-stale-save-20260716',
    'products',
    'restauracao-lipoland-apos-salvamento-antigo.sql',
    'upsert',
    1,
    1,
    0,
    'restauracao-sistema@juniorimports',
    now()
  );

  raise notice 'Lipoland restaurado novamente apos salvamento isolado de tela antiga.';
end;
$$;
