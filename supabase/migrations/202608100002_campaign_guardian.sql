begin;

alter table public.cashback_campaigns
  add column if not exists category_ids text[] not null default '{}',
  add column if not exists coupon_mode text not null default 'exclusive',
  add column if not exists minimum_margin_percent numeric(7,2) not null default 0,
  add column if not exists guardian_status text not null default 'pending',
  add column if not exists calculation_version text not null default 'commerce-v2',
  add column if not exists published_revision integer not null default 0;

alter table public.cashback_campaigns
  drop constraint if exists cashback_campaigns_coupon_mode_check,
  drop constraint if exists cashback_campaigns_guardian_status_check,
  drop constraint if exists cashback_campaigns_minimum_margin_check;

alter table public.cashback_campaigns
  add constraint cashback_campaigns_coupon_mode_check check (coupon_mode in ('exclusive', 'compatible')),
  add constraint cashback_campaigns_guardian_status_check check (guardian_status in ('pending', 'approved', 'warning', 'blocked')),
  add constraint cashback_campaigns_minimum_margin_check check (minimum_margin_percent between -100 and 100);

create table if not exists public.campaign_financial_simulations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id text references public.cashback_campaigns(id) on delete cascade,
  campaign_revision integer not null default 1,
  calculation_version text not null,
  scenario_key text not null,
  scenario_label text not null,
  input jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  paid_amount numeric(12,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  cashback_amount numeric(12,2) not null default 0,
  cost_amount numeric(12,2) not null default 0,
  margin_amount numeric(12,2) not null default 0,
  margin_percent numeric(9,2) not null default 0,
  decision text not null check (decision in ('approved', 'warning', 'blocked')),
  warnings text[] not null default '{}',
  authorized_by uuid,
  authorization_reason text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists campaign_simulations_tenant_campaign_idx
  on public.campaign_financial_simulations (tenant_id, campaign_id, created_at desc);

alter table public.campaign_financial_simulations enable row level security;

drop policy if exists "tenant campaign simulations read" on public.campaign_financial_simulations;
create policy "tenant campaign simulations read" on public.campaign_financial_simulations
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'marketing')
  or public.has_tenant_permission(tenant_id, 'finance')
);

revoke all on table public.campaign_financial_simulations from anon, authenticated;
grant select on table public.campaign_financial_simulations to authenticated;

create or replace function public.enforce_cashback_campaign_guardian()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_simulation public.campaign_financial_simulations%rowtype;
  v_changed boolean := false;
  v_requires_guard boolean := false;
begin
  if tg_op = 'INSERT' then
    v_requires_guard := new.status = 'active';
  else
    v_changed := new.multiplier is distinct from old.multiplier
      or new.fixed_bonus is distinct from old.fixed_bonus
      or new.starts_at is distinct from old.starts_at
      or new.ends_at is distinct from old.ends_at
      or new.product_ids is distinct from old.product_ids
      or new.category_ids is distinct from old.category_ids
      or new.target_segments is distinct from old.target_segments
      or new.coupon_mode is distinct from old.coupon_mode
      or new.minimum_margin_percent is distinct from old.minimum_margin_percent;
    if v_changed then
      new.published_revision := old.published_revision + 1;
      new.guardian_status := 'pending';
    end if;
    v_requires_guard := new.status = 'active' and (old.status is distinct from 'active' or v_changed);
  end if;

  if v_requires_guard then
    select * into v_simulation from public.campaign_financial_simulations simulation
    where simulation.tenant_id = new.tenant_id and simulation.campaign_id = new.id
      and simulation.campaign_revision = new.published_revision
      and (
        simulation.decision = 'approved'
        or (simulation.decision = 'warning' and simulation.authorized_by is not null and length(simulation.authorization_reason) >= 5)
      )
    order by simulation.created_at desc limit 1;
    if not found then
      raise exception 'Simule e aprove a campanha no Guardião financeiro antes de ativá-la';
    end if;
    new.guardian_status := v_simulation.decision;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_cashback_campaign_guardian on public.cashback_campaigns;
create trigger enforce_cashback_campaign_guardian
before insert or update on public.cashback_campaigns
for each row execute function public.enforce_cashback_campaign_guardian();

commit;
