begin;

-- `orders` registra a criação e os eventos financeiros separadamente, mas não
-- possui `updated_at`. Recria a RPC sem tentar gravar uma coluna inexistente.
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

  insert into public.financial_transactions
    (tenant_id, id, type, status, description, amount, category, account, cost_center,
     due_date, paid_at, order_id, notes, external_key, created_at)
  values
    (p_tenant_id, v_transaction_id, 'income', 'paid', 'Pagamento ' || v_order.code,
     v_amount, 'Vendas', 'Conta principal', 'Comercial', timezone('America/Sao_Paulo', p_paid_at)::date, p_paid_at,
     p_order_id, v_note, 'order-payment:' || p_order_id || ':' || v_transaction_id, now());

  if v_complete then
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
    'lifecycle_version', v_order.lifecycle_version + 1
  );
end;
$$;

revoke all on function public.register_tenant_order_payment(uuid, text, numeric, timestamptz, integer, text)
  from public, anon;
grant execute on function public.register_tenant_order_payment(uuid, text, numeric, timestamptz, integer, text)
  to authenticated;

commit;
