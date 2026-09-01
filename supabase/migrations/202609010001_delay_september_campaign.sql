begin;

-- Adia toda a campanha de setembro para segunda-feira, 07/09/2026.
-- Pedidos já registrados mantêm seus snapshots, descontos e cashback. A nova
-- janela vale apenas para pedidos criados a partir da data abaixo.
update public.store_settings
set
  promotion_starts_at = '2026-09-07 00:00:00-03'::timestamptz,
  updated_at = now()
where promotion_name = 'Promoção Especial Setembro';

-- Mudar a janela de uma campanha ativa gera uma nova revisão no Guardião.
-- A regra financeira continua idêntica (1% sobre a base líquida, sem frete),
-- então a simulação aprovada da revisão anterior é reaplicada à nova revisão
-- antes de a campanha voltar ao estado ativo.
update public.cashback_campaigns
set
  status = 'draft',
  starts_at = '2026-09-07 00:00:00-03'::timestamptz,
  updated_at = now()
where id = 'cashback-september-2026';

with campaign as (
  select cashback.*
  from public.cashback_campaigns cashback
  where cashback.id = 'cashback-september-2026'
), approved_previous_revision as (
  select simulation.*
  from public.campaign_financial_simulations simulation
  join campaign
    on campaign.tenant_id = simulation.tenant_id
   and campaign.id = simulation.campaign_id
  where simulation.campaign_revision < campaign.published_revision
    and simulation.decision = 'approved'
  order by simulation.campaign_revision desc, simulation.created_at desc
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
  warnings,
  authorized_by,
  authorization_reason,
  created_by
)
select
  previous.tenant_id,
  previous.campaign_id,
  campaign.published_revision,
  previous.calculation_version,
  previous.scenario_key || '-start-2026-09-07',
  previous.scenario_label || ' — início em 07/09/2026',
  previous.input || jsonb_build_object(
    'campaignStartsAt', '2026-09-07T03:00:00.000Z',
    'revisionReason', 'Campanha adiada para segunda-feira; benefício financeiro inalterado'
  ),
  previous.result,
  previous.paid_amount,
  previous.discount_amount,
  previous.cashback_amount,
  previous.cost_amount,
  previous.margin_amount,
  previous.margin_percent,
  previous.decision,
  previous.warnings,
  previous.authorized_by,
  previous.authorization_reason,
  previous.created_by
from campaign
join approved_previous_revision previous on true;

do $$
begin
  if not exists (
    select 1
    from public.campaign_financial_simulations simulation
    join public.cashback_campaigns campaign
      on campaign.tenant_id = simulation.tenant_id
     and campaign.id = simulation.campaign_id
     and campaign.published_revision = simulation.campaign_revision
    where campaign.id = 'cashback-september-2026'
      and simulation.decision = 'approved'
  ) then
    raise exception 'A nova janela da campanha de setembro não possui simulação financeira aprovada';
  end if;
end;
$$;

update public.cashback_campaigns
set
  status = 'active',
  updated_at = now()
where id = 'cashback-september-2026';

notify pgrst, 'reload schema';

commit;
