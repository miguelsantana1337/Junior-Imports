begin;

alter table public.orders add column if not exists referral_code text not null default '';

create table if not exists public.referral_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  reward_type text not null check (reward_type in ('percent', 'fixed')),
  reward_value numeric(12,2) not null check (reward_value > 0),
  reward_cap numeric(12,2) not null default 0 check (reward_cap >= 0),
  credit_valid_days integer not null default 90 check (credit_valid_days between 1 and 730),
  max_rewards_per_referrer integer not null default 0 check (max_rewards_per_referrer >= 0),
  max_rewards_per_month integer not null default 0 check (max_rewards_per_month >= 0),
  minimum_order_amount numeric(12,2) not null default 0 check (minimum_order_amount >= 0),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  customer_id text not null references public.customers(id) on delete cascade,
  code text not null,
  status text not null default 'active' check (status in ('active', 'revoked', 'expired')),
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, customer_id),
  unique (tenant_id, code)
);

create table if not exists public.referral_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  campaign_id uuid not null references public.referral_campaigns(id) on delete restrict,
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  referrer_customer_id text not null references public.customers(id) on delete restrict,
  referred_customer_id text not null references public.customers(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  status text not null default 'tracked' check (status in ('tracked', 'eligible', 'rewarded', 'blocked', 'reversed')),
  source text not null default 'checkout',
  block_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, referred_customer_id),
  unique (tenant_id, order_id),
  check (referrer_customer_id <> referred_customer_id)
);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  referral_link_id uuid not null references public.referral_links(id) on delete restrict,
  order_id text not null references public.orders(id) on delete restrict,
  beneficiary_customer_id text not null references public.customers(id) on delete restrict,
  eligible_base numeric(12,2) not null default 0 check (eligible_base >= 0),
  reward_type text not null check (reward_type in ('percent', 'fixed')),
  reward_value numeric(12,2) not null check (reward_value > 0),
  reward_amount numeric(12,2) not null default 0 check (reward_amount >= 0),
  status text not null default 'predicted' check (status in ('predicted', 'available', 'blocked', 'reversed')),
  cashback_entry_id uuid references public.cashback_entries(id) on delete restrict,
  reversal_entry_id uuid references public.cashback_entries(id) on delete restrict,
  available_at timestamptz,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, referral_link_id)
);

create table if not exists public.referral_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  referral_link_id uuid references public.referral_links(id) on delete restrict,
  signal_key text not null,
  decision text not null check (decision in ('pending', 'approved', 'blocked')),
  evidence jsonb not null default '{}'::jsonb,
  reason text not null default '',
  actor_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists referral_campaigns_window_idx
  on public.referral_campaigns (tenant_id, status, starts_at, ends_at);
create index if not exists referral_links_referrer_idx
  on public.referral_links (tenant_id, referrer_customer_id, created_at desc);
create index if not exists referral_rewards_status_idx
  on public.referral_rewards (tenant_id, status, created_at desc);

alter table public.referral_campaigns enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_links enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_reviews enable row level security;

drop policy if exists "tenant referral campaigns manage" on public.referral_campaigns;
create policy "tenant referral campaigns manage" on public.referral_campaigns for all to authenticated
using (public.has_tenant_permission(tenant_id, 'marketing'))
with check (public.has_tenant_permission(tenant_id, 'marketing'));
drop policy if exists "tenant referral codes manage" on public.referral_codes;
create policy "tenant referral codes manage" on public.referral_codes for all to authenticated
using (public.has_tenant_permission(tenant_id, 'customers'))
with check (public.has_tenant_permission(tenant_id, 'customers'));
drop policy if exists "tenant referral links read" on public.referral_links;
create policy "tenant referral links read" on public.referral_links for select to authenticated
using (public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'marketing'));
drop policy if exists "tenant referral rewards read" on public.referral_rewards;
create policy "tenant referral rewards read" on public.referral_rewards for select to authenticated
using (public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'finance'));
drop policy if exists "tenant referral reviews manage" on public.referral_reviews;
create policy "tenant referral reviews manage" on public.referral_reviews for all to authenticated
using (public.has_tenant_permission(tenant_id, 'customers'))
with check (public.has_tenant_permission(tenant_id, 'customers'));

revoke all on table public.referral_campaigns, public.referral_codes,
  public.referral_links, public.referral_rewards from anon, authenticated;
grant select, insert, update, delete on table public.referral_campaigns, public.referral_codes to authenticated;
grant select on table public.referral_links, public.referral_rewards to authenticated;
grant select, insert, update on table public.referral_reviews to authenticated;

create or replace function public.attach_referral_to_order(
  p_tenant_id uuid,
  p_order_id text,
  p_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_code public.referral_codes%rowtype;
  v_campaign public.referral_campaigns%rowtype;
  v_link_id uuid;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if trim(coalesce(p_code, '')) = '' then return jsonb_build_object('attached', false); end if;

  select * into v_order from public.orders
  where tenant_id = p_tenant_id and id = p_order_id for update;
  if not found or coalesce(v_order.customer_id, '') = '' then
    raise exception 'Pedido ou cliente não encontrado';
  end if;

  select * into v_code from public.referral_codes
  where tenant_id = p_tenant_id
    and upper(code) = upper(trim(p_code))
    and status = 'active'
    and (expires_at is null or expires_at > now());
  if not found then raise exception 'Código de indicação inválido ou expirado'; end if;
  if v_code.customer_id = v_order.customer_id then raise exception 'Autoindicação não é permitida'; end if;
  if exists (
    select 1 from public.referral_links circular
    where circular.tenant_id = p_tenant_id
      and circular.referrer_customer_id = v_order.customer_id
      and circular.referred_customer_id = v_code.customer_id
  ) then raise exception 'Vínculo circular de indicação não é permitido'; end if;

  if exists (
    select 1 from public.orders previous
    where previous.tenant_id = p_tenant_id
      and previous.customer_id = v_order.customer_id
      and previous.id <> v_order.id
      and previous.status <> 'Cancelado'
  ) then
    raise exception 'A indicação é válida somente para a primeira compra do cliente';
  end if;

  select * into v_campaign from public.referral_campaigns
  where tenant_id = p_tenant_id and status = 'active'
    and starts_at <= now() and (ends_at is null or ends_at >= now())
    and greatest(0, coalesce(v_order.financial_total, v_order.total) - v_order.shipping) >= minimum_order_amount
  order by starts_at desc limit 1;
  if not found then raise exception 'Não há campanha de indicação ativa para este pedido'; end if;

  insert into public.referral_links (
    tenant_id, campaign_id, referral_code_id, referrer_customer_id,
    referred_customer_id, order_id, status, source
  ) values (
    p_tenant_id, v_campaign.id, v_code.id, v_code.customer_id,
    v_order.customer_id, v_order.id, 'tracked', 'checkout'
  )
  on conflict (tenant_id, order_id) do update set updated_at = now()
  returning id into v_link_id;

  insert into public.referral_rewards (
    tenant_id, referral_link_id, order_id, beneficiary_customer_id,
    reward_type, reward_value, status
  ) values (
    p_tenant_id, v_link_id, v_order.id, v_code.customer_id,
    v_campaign.reward_type, v_campaign.reward_value, 'predicted'
  ) on conflict (tenant_id, referral_link_id) do nothing;

  update public.orders set referral_code = upper(trim(p_code))
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object('attached', true, 'referral_link_id', v_link_id);
end;
$$;

create or replace function public.grant_referral_manual_bonus(
  p_tenant_id uuid,
  p_customer_id text,
  p_amount numeric,
  p_valid_days integer,
  p_confirmation_id uuid,
  p_actor_id uuid,
  p_actor_email text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_confirmation public.operational_action_confirmations%rowtype;
  v_entry_id uuid;
  v_amount numeric(12,2) := round(coalesce(p_amount, 0), 2);
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if v_amount <= 0 or v_amount > 100000 then raise exception 'Valor de bônus inválido'; end if;
  if p_valid_days < 1 or p_valid_days > 730 then raise exception 'Validade inválida'; end if;
  if length(v_reason) < 5 or length(v_reason) > 300 then raise exception 'Informe um motivo entre 5 e 300 caracteres'; end if;
  if not exists (select 1 from public.customers where tenant_id = p_tenant_id and id = p_customer_id) then
    raise exception 'Cliente não encontrado';
  end if;

  select * into v_confirmation from public.operational_action_confirmations
  where id = p_confirmation_id and tenant_id = p_tenant_id and actor_id = p_actor_id
    and action = 'grant_referral_manual_bonus' and entity_type = 'customer' and entity_id = p_customer_id
    and used_at is null and expires_at > now() for update;
  if not found then raise exception 'Confirmação inválida ou expirada'; end if;

  insert into public.cashback_entries (
    tenant_id, customer_id, kind, amount, description, operation_id,
    expires_at, actor_id, actor_email, metadata
  ) values (
    p_tenant_id, p_customer_id, 'adjustment_credit', v_amount,
    'Bônus manual de indicação: ' || v_reason, gen_random_uuid(),
    now() + make_interval(days => p_valid_days), p_actor_id,
    left(coalesce(p_actor_email, ''), 200), jsonb_build_object('source', 'referral_manual_bonus')
  ) returning id into v_entry_id;

  update public.operational_action_confirmations set used_at = now() where id = p_confirmation_id;
  insert into public.audit_logs (
    tenant_id, actor_id, actor_email, action, entity_type, entity_id,
    entity_label, before_data, after_data
  ) values (
    p_tenant_id, p_actor_id, left(coalesce(p_actor_email, ''), 200), 'insert',
    'referral_manual_bonus', v_entry_id::text, p_customer_id, null,
    jsonb_build_object('customer_id', p_customer_id, 'amount', v_amount, 'valid_days', p_valid_days, 'reason', v_reason)
  );
  return jsonb_build_object('id', v_entry_id, 'amount', v_amount);
end;
$$;

create or replace function public.sync_referral_reward_from_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.referral_links%rowtype;
  v_campaign public.referral_campaigns%rowtype;
  v_reward public.referral_rewards%rowtype;
  v_base numeric(12,2);
  v_amount numeric(12,2);
  v_entry_id uuid;
  v_reversal_id uuid;
  v_month_count integer;
  v_total_count integer;
begin
  select * into v_link from public.referral_links
  where tenant_id = new.tenant_id and order_id = new.id;
  if not found then return new; end if;

  select * into v_campaign from public.referral_campaigns where id = v_link.campaign_id;
  select * into v_reward from public.referral_rewards
  where tenant_id = new.tenant_id and referral_link_id = v_link.id for update;

  if new.payment_status = 'Recebido' and old.payment_status is distinct from 'Recebido'
    and v_reward.status = 'predicted'
  then
    select count(*) into v_total_count from public.referral_rewards
    where tenant_id = new.tenant_id and beneficiary_customer_id = v_link.referrer_customer_id and status = 'available';
    select count(*) into v_month_count from public.referral_rewards
    where tenant_id = new.tenant_id and beneficiary_customer_id = v_link.referrer_customer_id
      and status = 'available' and available_at >= date_trunc('month', now());

    if (v_campaign.max_rewards_per_referrer > 0 and v_total_count >= v_campaign.max_rewards_per_referrer)
      or (v_campaign.max_rewards_per_month > 0 and v_month_count >= v_campaign.max_rewards_per_month)
    then
      update public.referral_links set status = 'blocked', block_reason = 'Limite da campanha atingido', updated_at = now() where id = v_link.id;
      update public.referral_rewards set status = 'blocked', updated_at = now() where id = v_reward.id;
      return new;
    end if;

    v_base := round(greatest(0, coalesce(new.financial_total, new.total) - new.shipping), 2);
    v_amount := case when v_campaign.reward_type = 'percent'
      then round(v_base * v_campaign.reward_value / 100, 2)
      else round(v_campaign.reward_value, 2) end;
    if v_campaign.reward_cap > 0 then v_amount := least(v_amount, v_campaign.reward_cap); end if;

    if v_amount > 0 then
      insert into public.cashback_entries (
        tenant_id, customer_id, kind, amount, description, order_id,
        operation_id, expires_at, metadata
      ) values (
        new.tenant_id, v_link.referrer_customer_id, 'adjustment_credit', v_amount,
        'Bônus por indicação confirmada no pedido ' || new.code, new.id,
        gen_random_uuid(), now() + make_interval(days => v_campaign.credit_valid_days),
        jsonb_build_object('referral_link_id', v_link.id, 'eligible_base', v_base, 'campaign_id', v_campaign.id)
      ) returning id into v_entry_id;

      update public.referral_rewards set eligible_base = v_base, reward_amount = v_amount,
        status = 'available', cashback_entry_id = v_entry_id, available_at = now(), updated_at = now()
      where id = v_reward.id;
      update public.referral_links set status = 'rewarded', updated_at = now() where id = v_link.id;
    end if;
  end if;

  if new.status = 'Cancelado' and old.status is distinct from 'Cancelado'
    and v_reward.status = 'available' and v_reward.cashback_entry_id is not null
  then
    insert into public.cashback_entries (
      tenant_id, customer_id, kind, amount, description, order_id,
      reference_entry_id, operation_id, metadata
    ) values (
      new.tenant_id, v_link.referrer_customer_id, 'order_reversal', v_reward.reward_amount,
      'Reversão do bônus de indicação do pedido ' || new.code, new.id,
      v_reward.cashback_entry_id, gen_random_uuid(), jsonb_build_object('referral_link_id', v_link.id)
    ) on conflict do nothing returning id into v_reversal_id;

    update public.referral_rewards set status = 'reversed', reversal_entry_id = v_reversal_id,
      reversed_at = now(), updated_at = now() where id = v_reward.id;
    update public.referral_links set status = 'reversed', updated_at = now() where id = v_link.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_referral_reward_from_order on public.orders;
create trigger sync_referral_reward_from_order
after update of payment_status, status on public.orders
for each row execute function public.sync_referral_reward_from_order();

revoke all on function public.attach_referral_to_order(uuid, text, text) from public, anon, authenticated;
grant execute on function public.attach_referral_to_order(uuid, text, text) to service_role;
revoke all on function public.grant_referral_manual_bonus(uuid, text, numeric, integer, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.grant_referral_manual_bonus(uuid, text, numeric, integer, uuid, uuid, text, text) to service_role;

commit;
