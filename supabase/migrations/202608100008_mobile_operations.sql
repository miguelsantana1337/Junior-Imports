begin;

create table if not exists public.product_barcodes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  barcode text not null,
  symbology text not null default 'unknown',
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, barcode)
);

create table if not exists public.operation_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_id uuid not null,
  source text not null check (source in ('voice', 'barcode', 'manual', 'chatgpt')),
  intent text not null,
  transcript text not null default '',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'discarded', 'expired')),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.operation_reversals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  original_type text not null check (original_type in ('inventory_movement', 'financial_transaction', 'cashback_entry')),
  original_id text not null,
  compensating_type text not null,
  compensating_id text not null,
  preview jsonb not null default '{}'::jsonb,
  reason text not null,
  actor_id uuid not null,
  actor_email text not null default '',
  confirmation_id uuid references public.operational_action_confirmations(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (tenant_id, original_type, original_id)
);

create index if not exists product_barcodes_lookup_idx on public.product_barcodes (tenant_id, barcode) where active;
create index if not exists operation_drafts_actor_idx on public.operation_drafts (tenant_id, actor_id, status, created_at desc);
create index if not exists operation_reversals_created_idx on public.operation_reversals (tenant_id, created_at desc);

alter table public.product_barcodes enable row level security;
alter table public.operation_drafts enable row level security;
alter table public.operation_reversals enable row level security;

drop policy if exists "tenant product barcodes manage" on public.product_barcodes;
create policy "tenant product barcodes manage" on public.product_barcodes for all to authenticated
using (public.has_tenant_permission(tenant_id, 'inventory'))
with check (public.has_tenant_permission(tenant_id, 'inventory'));
drop policy if exists "own operation drafts manage" on public.operation_drafts;
create policy "own operation drafts manage" on public.operation_drafts for all to authenticated
using (actor_id = auth.uid() and public.has_tenant_permission(tenant_id, 'dashboard'))
with check (actor_id = auth.uid() and public.has_tenant_permission(tenant_id, 'dashboard'));
drop policy if exists "tenant operation reversals read" on public.operation_reversals;
create policy "tenant operation reversals read" on public.operation_reversals for select to authenticated
using (
  public.has_tenant_permission(tenant_id, 'inventory')
  or public.has_tenant_permission(tenant_id, 'finance')
  or public.has_tenant_permission(tenant_id, 'customers')
);

revoke all on table public.product_barcodes, public.operation_drafts,
  public.operation_reversals from anon, authenticated;
grant select, insert, update, delete on table public.product_barcodes, public.operation_drafts to authenticated;
grant select on table public.operation_reversals to authenticated;

create or replace function public.apply_operational_reversal(
  p_tenant_id uuid,
  p_original_type text,
  p_original_id text,
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
  v_inventory public.inventory_movements%rowtype;
  v_finance public.financial_transactions%rowtype;
  v_cashback public.cashback_entries%rowtype;
  v_compensating_id text := gen_random_uuid()::text;
  v_balance integer;
  v_delta integer;
  v_kind text;
  v_allocated numeric(12,2);
  v_preview jsonb;
  v_reversal_id uuid;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if p_original_type not in ('inventory_movement', 'financial_transaction', 'cashback_entry') then
    raise exception 'Tipo de reversão inválido';
  end if;
  if length(v_reason) < 5 or length(v_reason) > 300 then raise exception 'Informe um motivo entre 5 e 300 caracteres'; end if;
  if exists (select 1 from public.operation_reversals where tenant_id = p_tenant_id and original_type = p_original_type and original_id = p_original_id) then
    raise exception 'Esta operação já foi revertida';
  end if;

  select * into v_confirmation from public.operational_action_confirmations
  where id = p_confirmation_id and tenant_id = p_tenant_id and actor_id = p_actor_id
    and action = 'reverse_' || p_original_type and entity_type = p_original_type
    and entity_id = p_original_id and used_at is null and expires_at > now()
  for update;
  if not found then raise exception 'Confirmação inválida ou expirada'; end if;

  if p_original_type = 'inventory_movement' then
    select * into v_inventory from public.inventory_movements
    where tenant_id = p_tenant_id and id = p_original_id for update;
    if not found then raise exception 'Movimento de estoque não encontrado'; end if;
    v_delta := -v_inventory.quantity;
    update public.products set stock = stock + v_delta, updated_at = now()
    where tenant_id = p_tenant_id and id = v_inventory.product_id and stock + v_delta >= 0
    returning stock into v_balance;
    if not found then raise exception 'A reversão deixaria o estoque negativo'; end if;
    v_compensating_id := 'reversal-' || v_inventory.id || '-' || gen_random_uuid()::text;
    insert into public.inventory_movements (
      tenant_id, id, product_id, type, quantity, balance_after, unit_cost,
      reference_type, reference_id, note, actor_email, created_at
    ) values (
      p_tenant_id, v_compensating_id, v_inventory.product_id,
      case when v_delta > 0 then 'return' else 'adjustment' end,
      v_delta, v_balance, v_inventory.unit_cost, 'reversal', v_inventory.id,
      'Reversão: ' || v_reason, left(coalesce(p_actor_email, ''), 200), now()
    );
    v_preview := jsonb_build_object('product_id', v_inventory.product_id, 'quantity', v_delta, 'balance_after', v_balance);
    v_kind := 'inventory_movement';

  elsif p_original_type = 'financial_transaction' then
    select * into v_finance from public.financial_transactions
    where tenant_id = p_tenant_id and id = p_original_id for update;
    if not found then raise exception 'Lançamento financeiro não encontrado'; end if;
    if v_finance.status <> 'paid' then raise exception 'Somente lançamentos realizados podem ser revertidos'; end if;
    v_compensating_id := 'reversal-' || v_finance.id || '-' || gen_random_uuid()::text;
    insert into public.financial_transactions (
      tenant_id, id, type, status, description, amount, category, account,
      cost_center, due_date, paid_at, order_id, purchase_order_id, recurring,
      notes, external_key, created_at
    ) values (
      p_tenant_id, v_compensating_id,
      case when v_finance.type = 'income' then 'expense' else 'income' end,
      'paid', 'Reversão de ' || v_finance.description, v_finance.amount,
      'Reversões', v_finance.account, v_finance.cost_center, current_date, now(),
      v_finance.order_id, v_finance.purchase_order_id, false,
      v_reason, 'reversal:' || v_finance.id, now()
    );
    v_preview := jsonb_build_object('amount', v_finance.amount, 'original_type', v_finance.type);
    v_kind := 'financial_transaction';

  else
    select * into v_cashback from public.cashback_entries
    where tenant_id = p_tenant_id and id::text = p_original_id for update;
    if not found then raise exception 'Lançamento de cashback não encontrado'; end if;
    if v_cashback.kind in ('order_credit', 'campaign_bonus', 'adjustment_credit') then
      select coalesce(sum(amount), 0) into v_allocated from public.cashback_allocations
      where tenant_id = p_tenant_id and credit_entry_id = v_cashback.id;
      if v_allocated > 0 then raise exception 'O crédito já foi utilizado e exige conciliação manual'; end if;
      v_kind := 'adjustment_debit';
    else
      v_kind := 'adjustment_credit';
    end if;
    insert into public.cashback_entries (
      tenant_id, customer_id, kind, amount, description, order_id,
      reference_entry_id, operation_id, actor_id, actor_email, metadata
    ) values (
      p_tenant_id, v_cashback.customer_id, v_kind, v_cashback.amount,
      'Reversão: ' || v_reason, v_cashback.order_id, v_cashback.id,
      gen_random_uuid(), p_actor_id, left(coalesce(p_actor_email, ''), 200),
      jsonb_build_object('original_kind', v_cashback.kind)
    ) returning id::text into v_compensating_id;
    v_preview := jsonb_build_object('amount', v_cashback.amount, 'original_kind', v_cashback.kind, 'new_kind', v_kind);
    v_kind := 'cashback_entry';
  end if;

  update public.operational_action_confirmations set used_at = now() where id = p_confirmation_id;
  insert into public.operation_reversals (
    tenant_id, original_type, original_id, compensating_type, compensating_id,
    preview, reason, actor_id, actor_email, confirmation_id
  ) values (
    p_tenant_id, p_original_type, p_original_id, v_kind, v_compensating_id,
    v_preview, v_reason, p_actor_id, left(coalesce(p_actor_email, ''), 200), p_confirmation_id
  ) returning id into v_reversal_id;

  insert into public.audit_logs (
    tenant_id, actor_id, actor_email, action, entity_type, entity_id,
    entity_label, before_data, after_data
  ) values (
    p_tenant_id, p_actor_id, left(coalesce(p_actor_email, ''), 200), 'insert',
    'operation_reversal', v_reversal_id::text, p_original_type || ' ' || p_original_id,
    jsonb_build_object('original_type', p_original_type, 'original_id', p_original_id),
    jsonb_build_object('compensating_id', v_compensating_id, 'reason', v_reason, 'preview', v_preview)
  );
  return jsonb_build_object('id', v_reversal_id, 'compensating_id', v_compensating_id, 'preview', v_preview);
end;
$$;

revoke all on function public.apply_operational_reversal(uuid, text, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.apply_operational_reversal(uuid, text, text, uuid, uuid, text, text) to service_role;

commit;
