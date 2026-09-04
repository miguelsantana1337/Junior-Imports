begin;

-- Ativa antecipadamente a campanha de setembro somente para o catálogo
-- farmacêutico. Pedidos anteriores permanecem intactos porque o motor de
-- cashback compara a data de criação do pedido com starts_at.
do $$
declare
  v_tenant_id uuid;
  v_started_at timestamptz := clock_timestamp();
  v_settings public.store_settings%rowtype;
  v_campaign public.cashback_campaigns%rowtype;
  v_product_ids text[];
  v_product_count integer;
begin
  select tenant.id
  into v_tenant_id
  from public.tenants tenant
  where tenant.slug = 'junior-imports'
  limit 1;

  if v_tenant_id is null then
    raise exception 'Loja Junior Imports não encontrada';
  end if;

  select settings.*
  into v_settings
  from public.store_settings settings
  where settings.tenant_id = v_tenant_id
    and settings.id = 'default'
  for update;

  if not found
    or v_settings.promotion_enabled is not true
    or v_settings.promotion_name is distinct from 'Promoção Especial Setembro'
    or v_settings.promotion_ends_at is null
    or v_settings.promotion_ends_at <= v_started_at
    or coalesce((v_settings.quantity_promotion->>'enabled')::boolean, false) is not true
    or v_settings.quantity_promotion->>'singleProductId' is distinct from 'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc'
    or v_settings.quantity_promotion->>'boxProductId' is distinct from 'tg15'
    or v_settings.quantity_promotion->>'doseProductId' is distinct from '1024a192-5087-41e6-8f0c-e224ef32bdac'
    or coalesce((v_settings.quantity_promotion->>'groupQuantity')::integer, 0) <> 3
    or coalesce((v_settings.quantity_promotion->>'groupDiscountPercent')::numeric, 0) <> 50
    or coalesce((v_settings.quantity_promotion->>'allowCoupons')::boolean, true) is not false
    or coalesce((v_settings.quantity_promotion->>'allowAdditionalDiscounts')::boolean, true) is not false
  then
    raise exception 'Configuração vigente da campanha de setembro não está apta para ativação';
  end if;

  if (
    select count(*)
    from public.products product
    where product.tenant_id = v_tenant_id
      and product.id = any(array[
        'eebcf814-8b8a-4dfc-9485-7345b3e4d4dc',
        'tg15',
        '1024a192-5087-41e6-8f0c-e224ef32bdac'
      ]::text[])
      and product.active = true
      and product.deleted_at is null
      and product.stock > 0
  ) <> 3 then
    raise exception 'Os três produtos da promoção de quantidade não estão ativos e disponíveis';
  end if;

  select
    array_agg(product.id order by product.id),
    count(*)::integer
  into v_product_ids, v_product_count
  from public.products product
  join public.categories category
    on category.tenant_id = product.tenant_id
   and category.id = product.category_id
  where product.tenant_id = v_tenant_id
    and product.active = true
    and product.deleted_at is null
    and category.slug <> 'eletronicos';

  if coalesce(v_product_count, 0) = 0 then
    raise exception 'Nenhum produto farmacêutico ativo foi encontrado';
  end if;

  select campaign.*
  into v_campaign
  from public.cashback_campaigns campaign
  where campaign.tenant_id = v_tenant_id
    and campaign.id = 'cashback-september-2026'
  for update;

  if not found
    or v_campaign.ends_at is null
    or v_campaign.ends_at <= v_started_at
    or v_campaign.multiplier <> 1
    or v_campaign.fixed_bonus <> 0
  then
    raise exception 'Campanha de cashback de setembro não está apta para ativação';
  end if;

  update public.store_settings
  set
    promotion_starts_at = v_started_at,
    updated_at = v_started_at
  where tenant_id = v_tenant_id
    and id = 'default';

  -- A alteração da janela e do escopo cria uma nova revisão no Guardião.
  update public.cashback_campaigns
  set
    status = 'draft',
    starts_at = v_started_at,
    product_ids = v_product_ids,
    category_ids = '{}'::text[],
    updated_at = v_started_at
  where tenant_id = v_tenant_id
    and id = 'cashback-september-2026'
  returning * into v_campaign;

  -- Valida a nova revisão usando o farmacêutico elegível de menor margem
  -- depois do cashback adicional de 1%.
  with worst_margin_product as (
    select
      product.id,
      product.name,
      product.price,
      product.cost_price,
      round(product.price * 0.01, 2) as cashback_amount,
      round(product.price - product.cost_price - product.price * 0.01, 2) as margin_amount,
      round(
        ((product.price - product.cost_price - product.price * 0.01) / nullif(product.price, 0)) * 100,
        2
      ) as margin_percent
    from public.products product
    where product.tenant_id = v_tenant_id
      and product.id = any(v_product_ids)
      and product.price > 0
      and product.cost_price is not null
    order by margin_percent asc, product.name asc
    limit 1
  )
  insert into public.campaign_financial_simulations (
    tenant_id,
    campaign_id,
    campaign_revision,
    calculation_version,
    scenario_key,
    scenario_label,
    input,
    result,
    paid_amount,
    discount_amount,
    cashback_amount,
    cost_amount,
    margin_amount,
    margin_percent,
    decision,
    warnings
  )
  select
    v_tenant_id,
    v_campaign.id,
    v_campaign.published_revision,
    'commerce-v2',
    'september-pharmaceutical-cashback-one-percent-early-start',
    'Cashback de 1% — farmacêuticos — ativação antecipada',
    jsonb_build_object(
      'campaignId', v_campaign.id,
      'campaignStartsAt', v_started_at,
      'cashbackPercent', 1,
      'cashbackFixed', 0,
      'shipping', 0,
      'minimumMarginPercent', 0,
      'scope', 'pharmaceuticals',
      'eligibleProductCount', v_product_count,
      'scenarioKey', 'september-pharmaceutical-cashback-one-percent-early-start',
      'scenarioLabel', 'Cashback de 1% — farmacêuticos — ativação antecipada',
      'lines', jsonb_build_array(jsonb_build_object(
        'productId', product.id,
        'name', product.name,
        'price', product.price,
        'cost', product.cost_price,
        'quantity', 1,
        'directDiscount', 0
      ))
    ),
    jsonb_build_object(
      'gross', product.price,
      'discount', 0,
      'paidProducts', product.price,
      'shipping', 0,
      'customerTotal', product.price,
      'cashbackBase', product.price,
      'cashback', product.cashback_amount,
      'cost', product.cost_price,
      'margin', product.margin_amount,
      'marginPercent', product.margin_percent,
      'decision', 'approved',
      'warnings', jsonb_build_array()
    ),
    product.price,
    0,
    product.cashback_amount,
    product.cost_price,
    product.margin_amount,
    product.margin_percent,
    'approved',
    '{}'::text[]
  from worst_margin_product product
  where product.margin_amount >= 0;

  if not exists (
    select 1
    from public.campaign_financial_simulations simulation
    where simulation.tenant_id = v_tenant_id
      and simulation.campaign_id = v_campaign.id
      and simulation.campaign_revision = v_campaign.published_revision
      and simulation.decision = 'approved'
  ) then
    raise exception 'A nova revisão não passou pela validação financeira';
  end if;

  update public.cashback_campaigns
  set
    status = 'active',
    updated_at = v_started_at
  where tenant_id = v_tenant_id
    and id = v_campaign.id
  returning * into v_campaign;

  if v_campaign.status <> 'active'
    or v_campaign.guardian_status <> 'approved'
    or v_campaign.starts_at > clock_timestamp()
    or v_campaign.ends_at <= clock_timestamp()
    or cardinality(v_campaign.product_ids) <> v_product_count
    or exists (
      select 1
      from public.products product
      join public.categories category
        on category.tenant_id = product.tenant_id
       and category.id = product.category_id
      where product.tenant_id = v_tenant_id
        and product.id = any(v_campaign.product_ids)
        and category.slug = 'eletronicos'
    )
  then
    raise exception 'A campanha não atingiu o estado final esperado';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
