begin;

create table if not exists public.cashback_campaigns (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  id text primary key default gen_random_uuid()::text,
  name text not null,
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'ended')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  multiplier numeric(6,2) not null default 1 check (multiplier >= 1 and multiplier <= 10),
  fixed_bonus numeric(12,2) not null default 0 check (fixed_bonus >= 0),
  credit_valid_days integer not null default 90 check (credit_valid_days between 1 and 730),
  priority integer not null default 0 check (priority between 0 and 1000),
  target_segments text[] not null default '{}',
  product_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (multiplier > 1 or fixed_bonus > 0),
  check (target_segments <@ array['new', 'active', 'recurring', 'vip', 'at_risk', 'inactive']::text[])
);

create table if not exists public.cashback_entries (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  id uuid primary key default gen_random_uuid(),
  customer_id text not null references public.customers(id) on delete restrict,
  kind text not null check (kind in ('order_credit', 'campaign_bonus', 'adjustment_credit', 'redemption', 'adjustment_debit', 'order_reversal')),
  amount numeric(12,2) not null check (amount > 0),
  description text not null default '',
  order_id text references public.orders(id) on delete restrict,
  campaign_id text references public.cashback_campaigns(id) on delete restrict,
  reference_entry_id uuid references public.cashback_entries(id) on delete restrict,
  operation_id uuid not null default gen_random_uuid(),
  expires_at timestamptz,
  actor_id uuid,
  actor_email text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cashback_allocations (
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  id uuid primary key default gen_random_uuid(),
  credit_entry_id uuid not null references public.cashback_entries(id) on delete restrict,
  consumption_entry_id uuid not null references public.cashback_entries(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  unique (credit_entry_id, consumption_entry_id)
);

create index if not exists cashback_campaigns_tenant_window
  on public.cashback_campaigns (tenant_id, status, starts_at, ends_at, priority desc);
create index if not exists cashback_entries_customer_created
  on public.cashback_entries (tenant_id, customer_id, created_at desc);
create index if not exists cashback_entries_expiry
  on public.cashback_entries (tenant_id, expires_at)
  where kind in ('order_credit', 'campaign_bonus', 'adjustment_credit');
create unique index if not exists cashback_entries_order_kind_unique
  on public.cashback_entries (tenant_id, order_id, kind)
  where order_id is not null and kind in ('order_credit', 'campaign_bonus');
create unique index if not exists cashback_entries_reversal_unique
  on public.cashback_entries (tenant_id, reference_entry_id, kind)
  where reference_entry_id is not null and kind = 'order_reversal';
create index if not exists cashback_allocations_credit
  on public.cashback_allocations (tenant_id, credit_entry_id);
create index if not exists cashback_allocations_consumption
  on public.cashback_allocations (tenant_id, consumption_entry_id);

alter table public.cashback_campaigns enable row level security;
alter table public.cashback_entries enable row level security;
alter table public.cashback_allocations enable row level security;

drop policy if exists "tenant cashback campaigns manage" on public.cashback_campaigns;
create policy "tenant cashback campaigns manage" on public.cashback_campaigns for all to authenticated
using (public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'marketing'))
with check (public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'marketing'));

drop policy if exists "tenant cashback entries read" on public.cashback_entries;
create policy "tenant cashback entries read" on public.cashback_entries for select to authenticated
using (public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'crm'));

drop policy if exists "tenant cashback allocations read" on public.cashback_allocations;
create policy "tenant cashback allocations read" on public.cashback_allocations for select to authenticated
using (public.has_tenant_permission(tenant_id, 'customers') or public.has_tenant_permission(tenant_id, 'crm'));

revoke all on table public.cashback_campaigns, public.cashback_entries, public.cashback_allocations from anon, authenticated;
grant select, insert, update, delete on table public.cashback_campaigns to authenticated;
grant select on table public.cashback_entries, public.cashback_allocations to authenticated;

create or replace function public.prevent_cashback_ledger_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'O ledger de cashback é imutável; registre um novo lançamento de correção';
end;
$$;

drop trigger if exists cashback_entries_immutable on public.cashback_entries;
create trigger cashback_entries_immutable
before update or delete on public.cashback_entries
for each row execute function public.prevent_cashback_ledger_mutation();

drop trigger if exists cashback_allocations_immutable on public.cashback_allocations;
create trigger cashback_allocations_immutable
before update or delete on public.cashback_allocations
for each row execute function public.prevent_cashback_ledger_mutation();

create or replace function public.cashback_available_balance(p_tenant_id uuid, p_customer_id text)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  with allocation_totals as (
    select
      coalesce(sum(allocation.amount) filter (where allocation.credit_entry_id = entry.id), 0) as credit_allocated,
      coalesce(sum(allocation.amount) filter (where allocation.consumption_entry_id = entry.id), 0) as debit_allocated,
      entry.id
    from public.cashback_entries entry
    left join public.cashback_allocations allocation
      on allocation.tenant_id = entry.tenant_id
     and (allocation.credit_entry_id = entry.id or allocation.consumption_entry_id = entry.id)
    where entry.tenant_id = p_tenant_id and entry.customer_id = p_customer_id
    group by entry.id
  ), totals as (
    select
      coalesce(sum(greatest(0, entry.amount - allocation.credit_allocated)) filter (
        where entry.kind in ('order_credit', 'campaign_bonus', 'adjustment_credit')
          and (entry.expires_at is null or entry.expires_at > now())
      ), 0) as active_credit,
      coalesce(sum(greatest(0, entry.amount - allocation.debit_allocated)) filter (
        where entry.kind in ('redemption', 'adjustment_debit', 'order_reversal')
      ), 0) as unallocated_debit
    from public.cashback_entries entry
    join allocation_totals allocation on allocation.id = entry.id
    where entry.tenant_id = p_tenant_id and entry.customer_id = p_customer_id
  )
  select greatest(0, active_credit - unallocated_debit) from totals;
$$;

create or replace function public.cashback_customer_segment(
  p_tenant_id uuid,
  p_customer_id text,
  p_exclude_order_id text default ''
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_total numeric := 0;
  v_first timestamptz;
  v_last timestamptz;
begin
  select count(*), coalesce(sum(total), 0), min(created_at), max(created_at)
  into v_count, v_total, v_first, v_last
  from public.orders
  where tenant_id = p_tenant_id
    and customer_id = p_customer_id
    and status <> 'Cancelado'
    and id <> coalesce(p_exclude_order_id, '');

  if v_count >= 5 or v_total >= 2500 then return 'vip'; end if;
  if v_count >= 2 and v_last < now() - interval '120 days' then return 'inactive'; end if;
  if v_count >= 2 and v_last < now() - interval '45 days' then return 'at_risk'; end if;
  if v_count >= 2 then return 'recurring'; end if;
  if v_count = 0 or v_first >= now() - interval '30 days' then return 'new'; end if;
  return 'active';
end;
$$;

create or replace function public.sync_order_cashback_wallet()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.cashback_campaigns%rowtype;
  v_segment text;
  v_matching_base numeric := 0;
  v_bonus numeric := 0;
  v_credit record;
  v_reversal_id uuid;
  v_allocated numeric := 0;
  v_remaining numeric := 0;
begin
  if new.customer_id is null or new.customer_id = '' then return new; end if;

  if new.status in ('Pago', 'Preparando', 'Enviado', 'Entregue') then
    if coalesce(new.cashback_total, 0) > 0 then
      insert into public.cashback_entries
        (tenant_id, customer_id, kind, amount, description, order_id, expires_at, metadata)
      values
        (new.tenant_id, new.customer_id, 'order_credit', round(new.cashback_total, 2),
         'Cashback do pedido ' || new.code, new.id, now() + interval '90 days',
         jsonb_build_object('order_code', new.code, 'base_cashback', new.cashback_total))
      on conflict do nothing;
    end if;

    v_segment := public.cashback_customer_segment(new.tenant_id, new.customer_id, new.id);
    select campaign.* into v_campaign
    from public.cashback_campaigns campaign
    where campaign.tenant_id = new.tenant_id
      and campaign.status = 'active'
      and campaign.starts_at <= now()
      and (campaign.ends_at is null or campaign.ends_at >= now())
      and (cardinality(campaign.target_segments) = 0 or v_segment = any(campaign.target_segments))
      and (
        cardinality(campaign.product_ids) = 0
        or exists (
          select 1 from public.order_items item
          where item.tenant_id = new.tenant_id and item.order_id = new.id
            and item.product_id = any(campaign.product_ids)
        )
      )
    order by campaign.priority desc, campaign.updated_at desc
    limit 1;

    if found then
      select coalesce(sum(item.quantity * item.unit_cashback), 0)
      into v_matching_base
      from public.order_items item
      where item.tenant_id = new.tenant_id and item.order_id = new.id
        and (cardinality(v_campaign.product_ids) = 0 or item.product_id = any(v_campaign.product_ids));
      v_bonus := round(v_matching_base * (v_campaign.multiplier - 1) + v_campaign.fixed_bonus, 2);
      if v_bonus > 0 then
        insert into public.cashback_entries
          (tenant_id, customer_id, kind, amount, description, order_id, campaign_id, expires_at, metadata)
        values
          (new.tenant_id, new.customer_id, 'campaign_bonus', v_bonus,
           'Bônus da campanha ' || v_campaign.name, new.id, v_campaign.id,
           now() + make_interval(days => v_campaign.credit_valid_days),
           jsonb_build_object('order_code', new.code, 'segment', v_segment, 'multiplier', v_campaign.multiplier))
        on conflict do nothing;
      end if;
    end if;
  end if;

  if new.status = 'Cancelado' and (tg_op = 'INSERT' or old.status <> 'Cancelado') then
    for v_credit in
      select entry.id, entry.amount, entry.description,
        greatest(0, entry.amount - coalesce((
          select sum(allocation.amount) from public.cashback_allocations allocation
          where allocation.tenant_id = entry.tenant_id and allocation.credit_entry_id = entry.id
        ), 0)) as remaining
      from public.cashback_entries entry
      where entry.tenant_id = new.tenant_id and entry.order_id = new.id
        and entry.kind in ('order_credit', 'campaign_bonus')
      order by entry.created_at
    loop
      insert into public.cashback_entries
        (tenant_id, customer_id, kind, amount, description, order_id, reference_entry_id, metadata)
      values
        (new.tenant_id, new.customer_id, 'order_reversal', v_credit.amount,
         'Estorno por cancelamento do pedido ' || new.code, new.id, v_credit.id,
         jsonb_build_object('order_code', new.code, 'reversed_description', v_credit.description))
      on conflict do nothing
      returning id into v_reversal_id;

      if v_reversal_id is not null then
        v_remaining := least(v_credit.amount, v_credit.remaining);
        if v_remaining > 0 then
          insert into public.cashback_allocations
            (tenant_id, credit_entry_id, consumption_entry_id, amount)
          values (new.tenant_id, v_credit.id, v_reversal_id, v_remaining)
          on conflict do nothing;
        end if;
      end if;
      v_reversal_id := null;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists sync_order_cashback_wallet on public.orders;
create trigger sync_order_cashback_wallet
after insert or update of status, cashback_total on public.orders
for each row execute function public.sync_order_cashback_wallet();

create or replace function public.adjust_customer_cashback(
  p_tenant_id uuid,
  p_customer_id text,
  p_amount numeric,
  p_reason text,
  p_valid_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid := gen_random_uuid();
  v_operation_id uuid := gen_random_uuid();
  v_actor uuid := auth.uid();
  v_actor_email text := '';
  v_to_allocate numeric;
  v_part numeric;
  v_credit record;
  v_kind text;
begin
  if not public.has_tenant_permission(p_tenant_id, 'customers') then raise exception 'Acesso negado à carteira'; end if;
  if p_amount is null or p_amount = 0 or abs(p_amount) > 100000 then raise exception 'Valor de ajuste inválido'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Informe o motivo do ajuste'; end if;
  if p_valid_days not between 1 and 730 then raise exception 'Validade inválida'; end if;
  if not exists (select 1 from public.customers where tenant_id = p_tenant_id and id = p_customer_id for update) then
    raise exception 'Cliente não encontrado';
  end if;
  select email into v_actor_email from public.profiles where id = v_actor;

  if p_amount > 0 then
    v_kind := 'adjustment_credit';
    insert into public.cashback_entries
      (tenant_id, id, customer_id, kind, amount, description, operation_id, expires_at, actor_id, actor_email)
    values
      (p_tenant_id, v_entry_id, p_customer_id, v_kind, round(p_amount, 2), trim(p_reason), v_operation_id,
       now() + make_interval(days => p_valid_days), v_actor, coalesce(v_actor_email, ''));
  else
    if abs(p_amount) > public.cashback_available_balance(p_tenant_id, p_customer_id) then
      raise exception 'Saldo de cashback insuficiente';
    end if;
    v_kind := 'adjustment_debit';
    v_to_allocate := round(abs(p_amount), 2);
    insert into public.cashback_entries
      (tenant_id, id, customer_id, kind, amount, description, operation_id, actor_id, actor_email)
    values
      (p_tenant_id, v_entry_id, p_customer_id, v_kind, v_to_allocate, trim(p_reason), v_operation_id,
       v_actor, coalesce(v_actor_email, ''));

    for v_credit in
      select entry.id,
        greatest(0, entry.amount - coalesce((
          select sum(allocation.amount) from public.cashback_allocations allocation
          where allocation.tenant_id = entry.tenant_id and allocation.credit_entry_id = entry.id
        ), 0)) as remaining
      from public.cashback_entries entry
      where entry.tenant_id = p_tenant_id and entry.customer_id = p_customer_id
        and entry.kind in ('order_credit', 'campaign_bonus', 'adjustment_credit')
        and (entry.expires_at is null or entry.expires_at > now())
      order by entry.expires_at nulls last, entry.created_at
      for update of entry
    loop
      exit when v_to_allocate <= 0;
      v_part := least(v_to_allocate, v_credit.remaining);
      if v_part > 0 then
        insert into public.cashback_allocations
          (tenant_id, credit_entry_id, consumption_entry_id, amount)
        values (p_tenant_id, v_credit.id, v_entry_id, v_part);
        v_to_allocate := v_to_allocate - v_part;
      end if;
    end loop;
  end if;

  insert into public.audit_logs
    (tenant_id, actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  values
    (p_tenant_id, v_actor, coalesce(v_actor_email, ''), 'insert', 'cashback_entries', v_entry_id::text,
     'Ajuste de cashback', null,
     jsonb_build_object('customer_id', p_customer_id, 'kind', v_kind, 'amount', abs(p_amount), 'reason', trim(p_reason)));

  return jsonb_build_object('id', v_entry_id, 'operation_id', v_operation_id, 'kind', v_kind, 'amount', abs(p_amount));
end;
$$;

drop view if exists public.cashback_wallet_entries_view;
create view public.cashback_wallet_entries_view
with (security_barrier = true, security_invoker = true)
as
select
  entry.tenant_id,
  entry.id,
  entry.customer_id,
  entry.kind,
  entry.amount,
  entry.description,
  entry.order_id,
  entry.campaign_id,
  entry.reference_entry_id,
  entry.operation_id,
  entry.expires_at,
  entry.actor_email,
  entry.created_at,
  case
    when entry.kind in ('order_credit', 'campaign_bonus', 'adjustment_credit') then coalesce(credit_allocated.amount, 0)
    else coalesce(debit_allocated.amount, 0)
  end as allocated_amount,
  case
    when entry.kind in ('order_credit', 'campaign_bonus', 'adjustment_credit')
      then greatest(0, entry.amount - coalesce(credit_allocated.amount, 0))
    else 0
  end as remaining_amount
from public.cashback_entries entry
left join (
  select tenant_id, credit_entry_id, sum(amount) as amount
  from public.cashback_allocations group by tenant_id, credit_entry_id
) credit_allocated on credit_allocated.tenant_id = entry.tenant_id and credit_allocated.credit_entry_id = entry.id
left join (
  select tenant_id, consumption_entry_id, sum(amount) as amount
  from public.cashback_allocations group by tenant_id, consumption_entry_id
) debit_allocated on debit_allocated.tenant_id = entry.tenant_id and debit_allocated.consumption_entry_id = entry.id;

revoke all on table public.cashback_wallet_entries_view from public, anon, authenticated;
grant select on table public.cashback_wallet_entries_view to authenticated;

drop trigger if exists admin_audit_change on public.cashback_campaigns;
create trigger admin_audit_change
after insert or update or delete on public.cashback_campaigns
for each row execute function public.capture_admin_audit();

revoke execute on function public.prevent_cashback_ledger_mutation() from public, anon, authenticated;
revoke execute on function public.cashback_available_balance(uuid, text) from public, anon, authenticated;
revoke execute on function public.cashback_customer_segment(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.sync_order_cashback_wallet() from public, anon, authenticated;
revoke execute on function public.adjust_customer_cashback(uuid, text, numeric, text, integer) from public, anon, authenticated;
grant execute on function public.adjust_customer_cashback(uuid, text, numeric, text, integer) to authenticated;

-- Conecta pedidos já confirmados à carteira sem duplicar créditos.
update public.orders
set cashback_total = cashback_total
where status in ('Pago', 'Preparando', 'Enviado', 'Entregue')
  and cashback_total > 0;

commit;
