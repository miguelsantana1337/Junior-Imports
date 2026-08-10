begin;

create table if not exists public.operational_divergences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rule_key text not null,
  entity_type text not null,
  entity_id text not null,
  entity_label text not null default '',
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'analyzing', 'prepared', 'resolved', 'ignored', 'reopened')),
  summary text not null,
  evidence jsonb not null default '{}'::jsonb,
  proposed_action text not null default '',
  impact_amount numeric(12,2),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  assigned_to uuid,
  resolution_reason text not null default '',
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, rule_key, entity_type, entity_id)
);

create table if not exists public.operational_action_confirmations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  payload_hash text not null,
  preview jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists operational_divergences_queue_idx
  on public.operational_divergences (tenant_id, status, severity, last_seen_at desc);
create index if not exists operational_action_confirmations_expiry_idx
  on public.operational_action_confirmations (tenant_id, actor_id, expires_at desc);

alter table public.operational_divergences enable row level security;
alter table public.operational_action_confirmations enable row level security;

drop policy if exists "tenant divergences read" on public.operational_divergences;
create policy "tenant divergences read" on public.operational_divergences
for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'orders')
  or public.has_tenant_permission(tenant_id, 'inventory')
  or public.has_tenant_permission(tenant_id, 'finance')
);

drop policy if exists "tenant divergences manage" on public.operational_divergences;
create policy "tenant divergences manage" on public.operational_divergences
for update to authenticated
using (
  public.has_tenant_permission(tenant_id, 'orders')
  and public.has_tenant_permission(tenant_id, 'inventory')
)
with check (
  public.has_tenant_permission(tenant_id, 'orders')
  and public.has_tenant_permission(tenant_id, 'inventory')
);

drop policy if exists "own action confirmations read" on public.operational_action_confirmations;
create policy "own action confirmations read" on public.operational_action_confirmations
for select to authenticated
using (actor_id = auth.uid() and public.has_tenant_permission(tenant_id, 'dashboard'));

revoke all on table public.operational_divergences, public.operational_action_confirmations from anon, authenticated;
grant select, update on table public.operational_divergences to authenticated;
grant select on table public.operational_action_confirmations to authenticated;

create or replace function public.scan_operational_divergences(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scan_at timestamptz := clock_timestamp();
  v_count integer := 0;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    o.tenant_id,
    'paid_without_stock',
    'order',
    o.id,
    o.code,
    'critical',
    'O pedido ' || o.code || ' está pago, mas a baixa de estoque não foi comprovada.',
    jsonb_build_object(
      'status', o.status,
      'payment_status', o.payment_status,
      'amount_paid', o.amount_paid,
      'missing_products', coalesce(jsonb_agg(distinct i.product_id) filter (where m.id is null), '[]'::jsonb)
    ),
    'commit_missing_stock',
    coalesce(o.financial_total, o.total),
    v_scan_at
  from public.orders o
  join public.order_items i on i.tenant_id = o.tenant_id and i.order_id = o.id and i.product_id is not null
    and (
      coalesce(i.is_component, false)
      or not exists (
        select 1 from public.product_bundles bundle
        where bundle.tenant_id = i.tenant_id and bundle.product_id = i.product_id
      )
    )
  left join public.inventory_movements m
    on m.tenant_id = o.tenant_id
   and m.reference_type = 'order'
   and m.reference_id = o.id
   and m.product_id = i.product_id
   and m.type = 'sale'
  where o.tenant_id = p_tenant_id
    and (o.payment_status = 'Recebido' or o.status in ('Pago', 'Entregue'))
  group by o.tenant_id, o.id, o.code, o.status, o.payment_status, o.amount_paid, o.financial_total, o.total
  having bool_or(m.id is null)
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    entity_label = excluded.entity_label,
    severity = excluded.severity,
    summary = excluded.summary,
    evidence = excluded.evidence,
    proposed_action = excluded.proposed_action,
    impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null,
    resolved_by = null,
    updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    o.tenant_id,
    'delivered_with_balance',
    'order',
    o.id,
    o.code,
    'critical',
    'O pedido ' || o.code || ' foi entregue, mas ainda possui saldo a receber.',
    jsonb_build_object(
      'operational_status', o.operational_status,
      'payment_status', o.payment_status,
      'amount_paid', o.amount_paid,
      'financial_total', coalesce(o.financial_total, o.total),
      'remaining', greatest(0, coalesce(o.financial_total, o.total) - o.amount_paid)
    ),
    'manual_payment_review',
    greatest(0, coalesce(o.financial_total, o.total) - o.amount_paid),
    v_scan_at
  from public.orders o
  where o.tenant_id = p_tenant_id
    and (o.operational_status = 'Entregue' or o.status = 'Entregue')
    and round(coalesce(o.amount_paid, 0), 2) < round(coalesce(o.financial_total, o.total), 2)
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action, impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    o.tenant_id,
    'payment_finance_mismatch',
    'order',
    o.id,
    o.code,
    'high',
    'Os pagamentos do pedido ' || o.code || ' não conferem com o valor recebido no pedido.',
    jsonb_build_object(
      'amount_paid', o.amount_paid,
      'finance_income', coalesce(f.income, 0),
      'difference', round(o.amount_paid - coalesce(f.income, 0), 2)
    ),
    'manual_finance_review',
    abs(round(o.amount_paid - coalesce(f.income, 0), 2)),
    v_scan_at
  from public.orders o
  left join lateral (
    select round(coalesce(sum(ft.amount), 0), 2) as income
    from public.financial_transactions ft
    where ft.tenant_id = o.tenant_id
      and ft.order_id = o.id
      and ft.type = 'income'
      and ft.status = 'paid'
  ) f on true
  where o.tenant_id = p_tenant_id
    and abs(round(coalesce(o.amount_paid, 0) - coalesce(f.income, 0), 2)) >= 0.01
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action, impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, last_seen_at
  )
  select
    o.tenant_id,
    'cancelled_active_reservation',
    'order',
    o.id,
    o.code,
    'high',
    'O pedido cancelado ' || o.code || ' ainda mantém reserva de estoque ativa.',
    jsonb_build_object('reservation_count', count(*), 'products', jsonb_agg(r.product_id)),
    'release_cancelled_reservations',
    v_scan_at
  from public.orders o
  join public.order_stock_reservations r
    on r.tenant_id = o.tenant_id and r.order_id = o.id and r.status = 'active'
  where o.tenant_id = p_tenant_id and o.status = 'Cancelado'
  group by o.tenant_id, o.id, o.code
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    o.tenant_id,
    'cashback_before_full_payment',
    'order',
    o.id,
    o.code,
    'critical',
    'O pedido ' || o.code || ' liberou cashback antes da quitação integral.',
    jsonb_build_object('payment_status', o.payment_status, 'amount_paid', o.amount_paid, 'credits', jsonb_agg(e.id)),
    'reverse_early_cashback',
    sum(e.amount),
    v_scan_at
  from public.orders o
  join public.cashback_entries e
    on e.tenant_id = o.tenant_id and e.order_id = o.id and e.kind in ('order_credit', 'campaign_bonus')
  where o.tenant_id = p_tenant_id and coalesce(o.payment_status, 'Pendente') <> 'Recebido'
  group by o.tenant_id, o.id, o.code, o.payment_status, o.amount_paid
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action, impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    movement.tenant_id,
    'duplicate_stock_commit',
    'order_product',
    movement.reference_id || ':' || movement.product_id,
    movement.reference_id || ' · ' || product.name,
    'critical',
    'O mesmo produto possui mais de uma baixa definitiva para o mesmo pedido.',
    jsonb_build_object(
      'order_id', movement.reference_id,
      'product_id', movement.product_id,
      'movement_ids', jsonb_agg(movement.id order by movement.created_at),
      'movement_count', count(*),
      'quantity_sum', sum(movement.quantity)
    ),
    'manual_inventory_review',
    abs(sum(movement.quantity)) * max(movement.unit_cost),
    v_scan_at
  from public.inventory_movements movement
  join public.products product on product.tenant_id = movement.tenant_id and product.id = movement.product_id
  where movement.tenant_id = p_tenant_id and movement.reference_type = 'order' and movement.type = 'sale'
  group by movement.tenant_id, movement.reference_id, movement.product_id, product.name
  having count(*) > 1
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action, impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    o.tenant_id,
    'cashback_value_mismatch',
    'order',
    o.id,
    o.code,
    'high',
    'O cashback registrado no pedido ' || o.code || ' não confere com o crédito liberado.',
    jsonb_build_object(
      'expected', round(o.cashback_total, 2),
      'credited', round(coalesce(credit.amount, 0), 2),
      'difference', round(o.cashback_total - coalesce(credit.amount, 0), 2)
    ),
    'manual_cashback_review',
    abs(round(o.cashback_total - coalesce(credit.amount, 0), 2)),
    v_scan_at
  from public.orders o
  left join lateral (
    select sum(entry.amount) as amount from public.cashback_entries entry
    where entry.tenant_id = o.tenant_id and entry.order_id = o.id and entry.kind = 'order_credit'
  ) credit on true
  where o.tenant_id = p_tenant_id and o.payment_status = 'Recebido'
    and abs(round(coalesce(o.cashback_total, 0) - coalesce(credit.amount, 0), 2)) >= 0.01
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action, impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, last_seen_at
  )
  select
    o.tenant_id,
    'bundle_components_incomplete',
    'order',
    o.id,
    o.code,
    'critical',
    'O kit do pedido ' || o.code || ' está com reserva ou baixa incompleta nos componentes.',
    jsonb_build_object(
      'payment_status', o.payment_status,
      'expected_components', component.expected_quantity,
      'reserved_components', reservation.reserved_quantity,
      'committed_components', movement.committed_quantity
    ),
    'manual_inventory_review',
    v_scan_at
  from public.orders o
  join lateral (
    select sum(quantity)::integer as expected_quantity from public.order_item_components component
    where component.tenant_id = o.tenant_id and component.order_id = o.id
  ) component on component.expected_quantity > 0
  left join lateral (
    select sum(quantity)::integer as reserved_quantity from public.order_stock_reservations reservation
    where reservation.tenant_id = o.tenant_id and reservation.order_id = o.id and reservation.status in ('active', 'committed')
      and exists (
        select 1 from public.order_item_components component_item
        where component_item.tenant_id = reservation.tenant_id and component_item.order_id = reservation.order_id
          and component_item.component_product_id = reservation.product_id
      )
  ) reservation on true
  left join lateral (
    select abs(sum(quantity))::integer as committed_quantity from public.inventory_movements stock
    where stock.tenant_id = o.tenant_id and stock.reference_type = 'order' and stock.reference_id = o.id and stock.type = 'sale'
      and exists (
        select 1 from public.order_item_components component_item
        where component_item.tenant_id = stock.tenant_id and component_item.order_id = o.id
          and component_item.component_product_id = stock.product_id
      )
  ) movement on true
  where o.tenant_id = p_tenant_id and (
    (o.payment_status <> 'Recebido' and coalesce(reservation.reserved_quantity, 0) <> component.expected_quantity)
    or (o.payment_status = 'Recebido' and coalesce(movement.committed_quantity, 0) <> component.expected_quantity)
  )
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  insert into public.operational_divergences (
    tenant_id, rule_key, entity_type, entity_id, entity_label, severity,
    summary, evidence, proposed_action, impact_amount, last_seen_at
  )
  select
    link.tenant_id,
    'invalid_referral_reward',
    'referral',
    link.id::text,
    o.code,
    'critical',
    'A indicação ligada ao pedido ' || o.code || ' foi premiada sem quitação válida ou após cancelamento.',
    jsonb_build_object(
      'order_id', o.id,
      'order_status', o.status,
      'payment_status', o.payment_status,
      'reward_status', reward.status,
      'reward_amount', reward.reward_amount
    ),
    'manual_cashback_review',
    reward.reward_amount,
    v_scan_at
  from public.referral_links link
  join public.orders o on o.tenant_id = link.tenant_id and o.id = link.order_id
  join public.referral_rewards reward on reward.tenant_id = link.tenant_id and reward.referral_link_id = link.id
  where link.tenant_id = p_tenant_id and reward.status = 'available'
    and (o.payment_status <> 'Recebido' or o.status = 'Cancelado')
  on conflict (tenant_id, rule_key, entity_type, entity_id) do update set
    severity = excluded.severity, summary = excluded.summary, evidence = excluded.evidence,
    proposed_action = excluded.proposed_action, impact_amount = excluded.impact_amount,
    occurrence_count = public.operational_divergences.occurrence_count + 1,
    last_seen_at = excluded.last_seen_at,
    status = case when public.operational_divergences.status in ('resolved', 'ignored') then 'reopened' else public.operational_divergences.status end,
    resolved_at = null, resolved_by = null, updated_at = now();

  update public.operational_divergences
  set status = 'resolved', resolution_reason = 'Consistência comprovada pela nova varredura',
      resolved_at = now(), updated_at = now()
  where tenant_id = p_tenant_id
    and status in ('open', 'analyzing', 'prepared', 'reopened')
    and last_seen_at < v_scan_at;

  select count(*) into v_count
  from public.operational_divergences
  where tenant_id = p_tenant_id and status in ('open', 'analyzing', 'prepared', 'reopened');
  return v_count;
end;
$$;

create or replace function public.apply_operational_reconciliation(
  p_tenant_id uuid,
  p_divergence_id uuid,
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
  v_divergence public.operational_divergences%rowtype;
  v_confirmation public.operational_action_confirmations%rowtype;
  v_order public.orders%rowtype;
  v_item record;
  v_reservation public.order_stock_reservations%rowtype;
  v_balance integer;
  v_allocated numeric(12,2);
  v_reason text := trim(coalesce(p_reason, ''));
  v_before jsonb;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if length(v_reason) < 5 or length(v_reason) > 300 then
    raise exception 'Informe um motivo entre 5 e 300 caracteres';
  end if;

  select * into v_divergence
  from public.operational_divergences
  where tenant_id = p_tenant_id and id = p_divergence_id
  for update;
  if not found then raise exception 'Divergência não encontrada'; end if;
  if v_divergence.status in ('resolved', 'ignored') then raise exception 'Divergência já encerrada'; end if;

  select * into v_confirmation
  from public.operational_action_confirmations
  where id = p_confirmation_id
    and tenant_id = p_tenant_id
    and actor_id = p_actor_id
    and entity_type = 'divergence'
    and entity_id = p_divergence_id::text
    and action = v_divergence.proposed_action
    and used_at is null
    and expires_at > now()
  for update;
  if not found then raise exception 'Confirmação inválida ou expirada'; end if;

  v_before := jsonb_build_object(
    'status', v_divergence.status,
    'rule_key', v_divergence.rule_key,
    'evidence', v_divergence.evidence
  );

  if v_divergence.proposed_action = 'release_cancelled_reservations' then
    update public.order_stock_reservations
    set status = 'released', updated_at = now()
    where tenant_id = p_tenant_id
      and order_id = v_divergence.entity_id
      and status = 'active';

  elsif v_divergence.proposed_action = 'commit_missing_stock' then
    select * into v_order from public.orders
    where tenant_id = p_tenant_id and id = v_divergence.entity_id
    for update;
    if not found then raise exception 'Pedido não encontrado'; end if;
    if not (v_order.payment_status = 'Recebido' or v_order.status in ('Pago', 'Entregue')) then
      raise exception 'O pedido não está integralmente pago';
    end if;

    for v_item in
      select i.*
      from public.order_items i
      where i.tenant_id = p_tenant_id and i.order_id = v_order.id and i.product_id is not null
        and not exists (
          select 1 from public.inventory_movements m
          where m.tenant_id = p_tenant_id and m.reference_type = 'order'
            and m.reference_id = v_order.id and m.product_id = i.product_id and m.type = 'sale'
        )
      order by i.product_id
    loop
      select * into v_reservation
      from public.order_stock_reservations
      where tenant_id = p_tenant_id and order_id = v_order.id and product_id = v_item.product_id
      for update;
      if not found or v_reservation.status not in ('active', 'committed') then
        raise exception 'A baixa exige análise manual: reserva ausente ou liberada';
      end if;

      if v_reservation.status = 'active' then
        update public.products
        set stock = stock - v_reservation.quantity, updated_at = now()
        where tenant_id = p_tenant_id and id = v_reservation.product_id and stock >= v_reservation.quantity
        returning stock into v_balance;
        if not found then raise exception 'Estoque insuficiente para reconciliar o pedido'; end if;
      else
        select stock into v_balance from public.products
        where tenant_id = p_tenant_id and id = v_reservation.product_id;
      end if;

      insert into public.inventory_movements (
        tenant_id, id, product_id, type, quantity, balance_after, unit_cost,
        reference_type, reference_id, note, actor_email, created_at
      ) values (
        p_tenant_id, 'reconcile-sale-' || v_order.id || '-' || v_item.product_id,
        v_item.product_id, 'sale', -v_reservation.quantity, v_balance,
        coalesce(v_item.unit_cost, 0), 'order', v_order.id,
        'Baixa reconciliada do pedido ' || v_order.code || ': ' || v_reason,
        left(coalesce(p_actor_email, ''), 200), now()
      ) on conflict (id) do nothing;

      update public.order_stock_reservations
      set status = 'committed', updated_at = now()
      where tenant_id = p_tenant_id and order_id = v_order.id and product_id = v_item.product_id;
    end loop;

  elsif v_divergence.proposed_action = 'reverse_early_cashback' then
    for v_item in
      select entry.*
      from public.cashback_entries entry
      where entry.tenant_id = p_tenant_id
        and entry.order_id = v_divergence.entity_id
        and entry.kind in ('order_credit', 'campaign_bonus')
    loop
      select coalesce(sum(amount), 0) into v_allocated
      from public.cashback_allocations
      where tenant_id = p_tenant_id and credit_entry_id = v_item.id;
      if v_allocated > 0 then
        raise exception 'O cashback já foi utilizado e exige análise financeira manual';
      end if;
      insert into public.cashback_entries (
        tenant_id, customer_id, kind, amount, description, order_id,
        reference_entry_id, operation_id, actor_id, actor_email, metadata
      ) values (
        p_tenant_id, v_item.customer_id, 'order_reversal', v_item.amount,
        'Reversão de cashback liberado antes da quitação', v_item.order_id,
        v_item.id, gen_random_uuid(), p_actor_id, left(coalesce(p_actor_email, ''), 200),
        jsonb_build_object('reason', v_reason, 'divergence_id', p_divergence_id)
      ) on conflict do nothing;
    end loop;
  else
    raise exception 'Esta divergência exige análise manual orientada';
  end if;

  update public.operational_action_confirmations set used_at = now()
  where id = p_confirmation_id;
  update public.operational_divergences
  set status = 'resolved', resolution_reason = v_reason, resolved_by = p_actor_id,
      resolved_at = now(), updated_at = now()
  where id = p_divergence_id;

  insert into public.audit_logs (
    tenant_id, actor_id, actor_email, action, entity_type, entity_id,
    entity_label, before_data, after_data, created_at
  ) values (
    p_tenant_id, p_actor_id, left(coalesce(p_actor_email, ''), 200), 'update',
    'operational_divergence', p_divergence_id::text, v_divergence.entity_label,
    v_before,
    jsonb_build_object('status', 'resolved', 'action', v_divergence.proposed_action, 'reason', v_reason),
    now()
  );

  return jsonb_build_object('id', p_divergence_id, 'status', 'resolved', 'action', v_divergence.proposed_action);
end;
$$;

revoke all on function public.scan_operational_divergences(uuid) from public, anon, authenticated;
grant execute on function public.scan_operational_divergences(uuid) to service_role;
revoke all on function public.apply_operational_reconciliation(uuid, uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_operational_reconciliation(uuid, uuid, uuid, uuid, text, text) to service_role;

commit;
