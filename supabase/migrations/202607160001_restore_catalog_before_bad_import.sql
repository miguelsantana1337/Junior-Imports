-- Restaura os 48 produtos sobrescritos pela importacao de produtos
-- 22865ada-35f5-4436-96fc-7756400bb1a9 em 15/07/2026, 21:26 BRT.
-- A importacao de estoque 99ea8f5a-539d-4c48-b82c-1d11893c0941,
-- executada em seguida, nao produziu diferencas adicionais.

create temporary table restore_catalog_22865ada_source on commit drop as
select
  entity_id as product_id,
  before_data,
  after_data
from public.audit_logs
where actor_email = 'junioraraujo66361@gmail.com'
  and action = 'update'
  and entity_type = 'products'
  and created_at = '2026-07-16 00:26:13.744103+00'::timestamptz;

do $$
declare
  source_count integer;
  current_count integer;
  mismatch_count integer;
begin
  if exists (
    select 1
    from public.catalog_imports
    where id = 'restore-22865ada-20260716'
  ) then
    raise notice 'A restauracao restore-22865ada-20260716 ja foi aplicada.';
    return;
  end if;

  select count(*), count(distinct product_id)
  into source_count, current_count
  from restore_catalog_22865ada_source;

  if source_count = 0 then
    raise notice 'Historico da importacao 22865ada nao existe neste ambiente; restauracao ignorada.';
    return;
  end if;

  if source_count <> 48 or current_count <> 48 then
    raise exception 'Restauracao interrompida: esperados 48 produtos distintos, encontrados % registros e % produtos.', source_count, current_count;
  end if;

  select count(*)
  into current_count
  from public.products product
  join restore_catalog_22865ada_source source on source.product_id = product.id;

  if current_count <> 48 then
    raise exception 'Restauracao interrompida: apenas % dos 48 produtos ainda existem.', current_count;
  end if;

  select count(*)
  into mismatch_count
  from public.products product
  join restore_catalog_22865ada_source source on source.product_id = product.id
  where product.name is distinct from source.after_data->>'name'
     or product.brand is distinct from source.after_data->>'brand'
     or product.stock is distinct from (source.after_data->>'stock')::integer
     or product.category_id is distinct from source.after_data->>'category_id'
     or product.active is distinct from (source.after_data->>'active')::boolean
     or product.featured is distinct from (source.after_data->>'featured')::boolean;

  if mismatch_count > 0 then
    raise exception 'Restauracao interrompida: % produtos receberam alteracoes posteriores nos campos afetados.', mismatch_count;
  end if;

  -- Registra o estado imediatamente anterior e o estado restaurado. A
  -- atualizacao e executada pela service role, portanto o log e inserido
  -- explicitamente para manter a operacao reversivel e auditavel.
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
    product.tenant_id,
    'restauracao-sistema@juniorimports',
    'update',
    'products',
    product.id,
    source.before_data->>'name',
    to_jsonb(product),
    to_jsonb(product) || jsonb_build_object(
      'name', source.before_data->>'name',
      'brand', source.before_data->>'brand',
      'stock', (source.before_data->>'stock')::integer,
      'category_id', source.before_data->>'category_id',
      'active', (source.before_data->>'active')::boolean,
      'featured', (source.before_data->>'featured')::boolean,
      'updated_at', now()
    ),
    now()
  from public.products product
  join restore_catalog_22865ada_source source on source.product_id = product.id;

  update public.products product
  set
    name = source.before_data->>'name',
    brand = source.before_data->>'brand',
    stock = (source.before_data->>'stock')::integer,
    category_id = source.before_data->>'category_id',
    active = (source.before_data->>'active')::boolean,
    featured = (source.before_data->>'featured')::boolean,
    updated_at = now()
  from restore_catalog_22865ada_source source
  where source.product_id = product.id;

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
    tenant_id,
    'restore-22865ada-20260716',
    'products',
    'restauracao-antes-da-importacao-22865ada.sql',
    'upsert',
    48,
    48,
    0,
    'restauracao-sistema@juniorimports',
    now()
  from public.products
  where id = (select product_id from restore_catalog_22865ada_source limit 1);

  raise notice 'Restauracao concluida: 48 produtos retornaram ao estado anterior a importacao 22865ada.';
end;
$$;
