begin;

-- A coluna `multiplier` passou a representar o percentual direto da campanha
-- (ex.: 1 = 1%). As constraints originais ainda refletiam o modelo antigo de
-- multiplicador e impediam a publicação de uma campanha de exatamente 1%.
alter table public.cashback_campaigns
  drop constraint if exists cashback_campaigns_multiplier_check;

do $$
declare
  v_constraint record;
begin
  for v_constraint in
    select constraint_row.conname
    from pg_constraint constraint_row
    where constraint_row.conrelid = 'public.cashback_campaigns'::regclass
      and constraint_row.contype = 'c'
      and pg_get_constraintdef(constraint_row.oid) ilike '%multiplier%'
      and pg_get_constraintdef(constraint_row.oid) ilike '%fixed_bonus%'
  loop
    execute format(
      'alter table public.cashback_campaigns drop constraint %I',
      v_constraint.conname
    );
  end loop;
end;
$$;

alter table public.cashback_campaigns
  drop constraint if exists cashback_campaigns_multiplier_percent_check,
  drop constraint if exists cashback_campaigns_benefit_check;

alter table public.cashback_campaigns
  add constraint cashback_campaigns_multiplier_percent_check
  check (multiplier >= 0.1 and multiplier <= 100);

alter table public.cashback_campaigns
  add constraint cashback_campaigns_benefit_check
  check (multiplier > 0 or fixed_bonus > 0);

-- A campanha começa apenas em setembro. Pedidos anteriores não são
-- recalculados porque o motor usa orders.created_at para escolher a campanha.
insert into public.cashback_campaigns (
  tenant_id,
  id,
  name,
  description,
  status,
  starts_at,
  ends_at,
  multiplier,
  fixed_bonus,
  credit_valid_days,
  priority,
  target_segments,
  product_ids,
  category_ids,
  coupon_mode,
  minimum_margin_percent,
  guardian_status,
  calculation_version
)
select
  tenant.id,
  'cashback-september-2026',
  'Cashback 1% — Setembro',
  '1% sobre o valor efetivamente pago pelos produtos após a promoção, sem incluir o frete.',
  'draft',
  '2026-09-01 00:00:00-03'::timestamptz,
  '2026-10-01 00:00:00-03'::timestamptz,
  1,
  0,
  90,
  300,
  '{}',
  '{}',
  '{}',
  'exclusive',
  0,
  'pending',
  'commerce-v2'
from public.tenants tenant
where tenant.slug = 'junior-imports'
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  status = 'draft',
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  multiplier = excluded.multiplier,
  fixed_bonus = excluded.fixed_bonus,
  credit_valid_days = excluded.credit_valid_days,
  priority = excluded.priority,
  target_segments = excluded.target_segments,
  product_ids = excluded.product_ids,
  category_ids = excluded.category_ids,
  coupon_mode = excluded.coupon_mode,
  minimum_margin_percent = excluded.minimum_margin_percent,
  guardian_status = 'pending',
  calculation_version = excluded.calculation_version,
  updated_at = now();

-- Aprovação financeira da regra de cashback, usando como amostra conservadora
-- o produto ativo de menor margem cadastrada. O custo da promoção de quantidade
-- continua independente; esta simulação aprova somente o cashback adicional de
-- 1% sobre a base líquida.
with campaign as (
  select cashback.*
  from public.cashback_campaigns cashback
  join public.tenants tenant on tenant.id = cashback.tenant_id
  where tenant.slug = 'junior-imports'
    and cashback.id = 'cashback-september-2026'
), worst_margin_product as (
  select
    product.tenant_id,
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
  join campaign on campaign.tenant_id = product.tenant_id
  where product.active = true
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
  campaign.tenant_id,
  campaign.id,
  campaign.published_revision,
  'commerce-v2',
  'september-cashback-one-percent-worst-margin',
  'Cashback de 1% — produto de menor margem',
  jsonb_build_object(
    'campaignId', campaign.id,
    'cashbackPercent', 1,
    'cashbackFixed', 0,
    'shipping', 0,
    'minimumMarginPercent', 0,
    'scenarioKey', 'september-cashback-one-percent-worst-margin',
    'scenarioLabel', 'Cashback de 1% — produto de menor margem',
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
  '{}'
from campaign
join worst_margin_product product on product.tenant_id = campaign.tenant_id
where product.margin_amount >= 0;

do $$
begin
  if not exists (
    select 1
    from public.campaign_financial_simulations simulation
    where simulation.campaign_id = 'cashback-september-2026'
      and simulation.decision = 'approved'
      and simulation.campaign_revision = (
        select campaign.published_revision
        from public.cashback_campaigns campaign
        where campaign.id = 'cashback-september-2026'
      )
  ) then
    raise exception 'A campanha de cashback de setembro não passou pela validação financeira';
  end if;
end;
$$;

update public.cashback_campaigns
set status = 'active',
    updated_at = now()
where id = 'cashback-september-2026';

commit;
