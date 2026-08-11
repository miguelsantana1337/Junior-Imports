begin;

-- No atacado, o primeiro valor recebido confirma a separacao integral do
-- pedido. A baixa e feita uma unica vez por reserva; as parcelas seguintes e a
-- quitacao apenas atualizam o financeiro.
create or replace function public.commit_tenant_order_stock_on_payment(
  p_tenant_id uuid,
  p_order_id text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_reservation public.order_stock_reservations%rowtype;
  v_balance integer;
  v_committed integer := 0;
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders')
    or not public.has_tenant_permission(p_tenant_id, 'finance')
  then
    raise exception 'Seu usuario precisa das permissoes Pedidos e Financeiro';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;
  if not found then raise exception 'Pedido nao encontrado'; end if;

  for v_reservation in
    select *
    from public.order_stock_reservations
    where tenant_id = p_tenant_id and order_id = p_order_id
    order by product_id
    for update
  loop
    if v_reservation.status in ('expired', 'released') then
      raise exception 'A reserva deste pedido nao esta mais disponivel';
    end if;

    if v_reservation.status = 'active' then
      update public.products
      set stock = stock - v_reservation.quantity, updated_at = now()
      where tenant_id = p_tenant_id
        and id = v_reservation.product_id
        and stock >= v_reservation.quantity
      returning stock into v_balance;
      if not found then raise exception 'Estoque insuficiente para confirmar o pagamento'; end if;

      insert into public.inventory_movements (
        tenant_id, id, product_id, type, quantity, balance_after, unit_cost,
        reference_type, reference_id, note
      )
      select
        p_tenant_id,
        'sale-' || p_order_id || '-' || v_reservation.product_id,
        v_reservation.product_id,
        'sale',
        -v_reservation.quantity,
        v_balance,
        coalesce(max(item.unit_cost), 0),
        'order',
        p_order_id,
        'Baixa confirmada no primeiro pagamento do pedido ' || v_order.code
      from public.order_items item
      where item.tenant_id = p_tenant_id
        and item.order_id = p_order_id
        and item.product_id = v_reservation.product_id
      on conflict (id) do nothing;

      update public.order_stock_reservations
      set status = 'committed', updated_at = now()
      where tenant_id = p_tenant_id
        and order_id = p_order_id
        and product_id = v_reservation.product_id
        and status = 'active';

      v_committed := v_committed + 1;
    end if;
  end loop;

  return v_committed;
end;
$$;

revoke all on function public.commit_tenant_order_stock_on_payment(uuid, text)
  from public, anon, authenticated;

create or replace function public.register_tenant_order_payment(
  p_tenant_id uuid,
  p_order_id text,
  p_amount numeric,
  p_paid_at timestamptz,
  p_expected_version integer,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_amount numeric(12,2) := round(coalesce(p_amount, 0), 2);
  v_total numeric(12,2);
  v_next_paid numeric(12,2);
  v_remaining numeric(12,2);
  v_complete boolean;
  v_operation text;
  v_status text;
  v_stock_movements integer := 0;
  v_transaction_id text := 'order-payment-' || p_order_id || '-' || gen_random_uuid()::text;
  v_note text := left(trim(coalesce(p_note, '')), 300);
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders')
    or not public.has_tenant_permission(p_tenant_id, 'finance')
  then
    raise exception 'Seu usuario precisa das permissoes Pedidos e Financeiro';
  end if;
  if v_amount <= 0 or v_amount > 1000000000 then
    raise exception 'Informe um valor de pagamento valido';
  end if;
  if p_paid_at is null or p_paid_at > now() + interval '5 minutes' then
    raise exception 'Informe uma data de pagamento valida';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido nao encontrado'; end if;
  if v_order.archived_at is not null then raise exception 'Restaure o pedido antes de registrar pagamentos'; end if;
  if v_order.operational_status in ('Cancelado', 'Entregue') then raise exception 'Este pedido nao aceita novos pagamentos'; end if;
  if v_order.payment_status in ('Recebido', 'Estornado', 'Cancelado') then raise exception 'O pagamento deste pedido ja esta encerrado'; end if;
  if coalesce(p_expected_version, 0) <> v_order.lifecycle_version then
    raise exception 'Este pedido foi alterado em outra tela. Atualize e tente novamente';
  end if;

  v_total := round(coalesce(v_order.financial_total, v_order.total), 2);
  v_remaining := round(v_total - v_order.amount_paid, 2);
  if v_amount > v_remaining then
    raise exception 'O pagamento ultrapassa o saldo restante de R$ %', replace(to_char(v_remaining, 'FM999999990D00'), '.', ',');
  end if;

  v_next_paid := round(v_order.amount_paid + v_amount, 2);
  v_complete := v_next_paid = v_total;
  v_operation := case
    when v_complete and v_order.operational_status in ('Novo', 'Em atendimento', 'Confirmado') then 'Em preparação'
    else v_order.operational_status
  end;
  v_status := case when v_complete then 'Pago' else v_order.status end;

  -- Caixa e estoque fazem parte da mesma transacao. Se a baixa falhar, o
  -- recebimento tambem nao e gravado.
  select public.commit_tenant_order_stock_on_payment(p_tenant_id, p_order_id)
    into v_stock_movements;

  insert into public.financial_transactions
    (tenant_id, id, type, status, description, amount, category, account, cost_center,
     due_date, paid_at, order_id, notes, external_key, created_at)
  values
    (p_tenant_id, v_transaction_id, 'income', 'paid', 'Pagamento ' || v_order.code,
     v_amount, 'Vendas', 'Conta principal', 'Comercial', timezone('America/Sao_Paulo', p_paid_at)::date, p_paid_at,
     p_order_id, v_note, 'order-payment:' || p_order_id || ':' || v_transaction_id, now());

  if v_complete then
    -- A rotina consolidada cria CMV/cashback. Como as reservas ja estao
    -- comprometidas, ela nao baixa o estoque novamente.
    perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Pago');
    update public.financial_transactions
    set status = 'cancelled', updated_at = now()
    where tenant_id = p_tenant_id
      and order_id = p_order_id
      and external_key = 'order-income:' || p_order_id;
  end if;

  update public.orders
  set
    status = v_status,
    operational_status = v_operation,
    payment_status = case when v_complete then 'Recebido' else 'Parcial' end,
    amount_paid = v_next_paid,
    lifecycle_version = lifecycle_version + 1
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'payment_id', v_transaction_id,
    'payment_amount', v_amount,
    'amount_paid', v_next_paid,
    'remaining', round(v_total - v_next_paid, 2),
    'payment_status', case when v_complete then 'Recebido' else 'Parcial' end,
    'operational_status', v_operation,
    'status', v_status,
    'stock_movements', v_stock_movements,
    'lifecycle_version', v_order.lifecycle_version + 1
  );
end;
$$;

revoke all on function public.register_tenant_order_payment(uuid, text, numeric, timestamptz, integer, text)
  from public, anon;
grant execute on function public.register_tenant_order_payment(uuid, text, numeric, timestamptz, integer, text)
  to authenticated;

-- A central de reconciliacao passa a exigir baixa tambem para pedidos com
-- pagamento parcial e entende que kits parcialmente pagos ja foram
-- comprometidos no estoque.
do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.scan_operational_divergences(uuid)'::regprocedure)
    into v_definition;
  if position($needle$and (o.payment_status = 'Recebido' or o.status in ('Pago', 'Entregue'))$needle$ in v_definition) = 0 then
    raise exception 'Nao foi possivel atualizar a regra paid_without_stock';
  end if;
  v_definition := replace(
    v_definition,
    $needle$and (o.payment_status = 'Recebido' or o.status in ('Pago', 'Entregue'))$needle$,
    $replacement$and (o.payment_status in ('Parcial', 'Recebido') or o.status in ('Pago', 'Entregue'))$replacement$
  );
  if position($needle$(o.payment_status <> 'Recebido' and coalesce(reservation.reserved_quantity, 0) <> component.expected_quantity)
    or (o.payment_status = 'Recebido' and coalesce(movement.committed_quantity, 0) <> component.expected_quantity)$needle$ in v_definition) = 0 then
    raise exception 'Nao foi possivel atualizar a regra bundle_components_incomplete';
  end if;
  v_definition := replace(
    v_definition,
    $needle$(o.payment_status <> 'Recebido' and coalesce(reservation.reserved_quantity, 0) <> component.expected_quantity)
    or (o.payment_status = 'Recebido' and coalesce(movement.committed_quantity, 0) <> component.expected_quantity)$needle$,
    $replacement$(o.payment_status not in ('Parcial', 'Recebido') and coalesce(reservation.reserved_quantity, 0) <> component.expected_quantity)
    or (o.payment_status in ('Parcial', 'Recebido') and coalesce(movement.committed_quantity, 0) <> component.expected_quantity)$replacement$
  );
  execute v_definition;

  select pg_get_functiondef('public.apply_operational_reconciliation(uuid,uuid,uuid,uuid,text,text)'::regprocedure)
    into v_definition;
  if position($needle$if not (v_order.payment_status = 'Recebido' or v_order.status in ('Pago', 'Entregue')) then$needle$ in v_definition) = 0 then
    raise exception 'Nao foi possivel atualizar a reconciliacao de estoque';
  end if;
  v_definition := replace(
    v_definition,
    $needle$if not (v_order.payment_status = 'Recebido' or v_order.status in ('Pago', 'Entregue')) then$needle$,
    $replacement$if not (v_order.payment_status in ('Parcial', 'Recebido') or v_order.status in ('Pago', 'Entregue')) then$replacement$
  );
  v_definition := replace(
    v_definition,
    'O pedido não está integralmente pago',
    'O pedido ainda não possui pagamento confirmado'
  );
  execute v_definition;
end;
$$;

comment on function public.commit_tenant_order_stock_on_payment(uuid, text) is
  'Compromete uma unica vez as reservas do pedido no primeiro pagamento confirmado.';

commit;
