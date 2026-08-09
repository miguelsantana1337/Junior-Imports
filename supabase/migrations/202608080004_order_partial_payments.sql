begin;

-- O pedido guarda o total efetivamente recebido. Cada recebimento continua
-- registrado individualmente em financial_transactions para preservar data,
-- valor, observacao e auditoria de todas as parcelas.
alter table public.orders
  add column if not exists amount_paid numeric(12,2) not null default 0;

update public.orders
set amount_paid = case
  when payment_status = 'Recebido' or status in ('Pago', 'Entregue')
    then round(coalesce(financial_total, total), 2)
  when payment_status = 'Parcial' then least(
    round(coalesce(financial_total, total), 2),
    coalesce((
      select round(sum(ft.amount), 2)
      from public.financial_transactions ft
      where ft.tenant_id = orders.tenant_id
        and ft.order_id = orders.id
        and ft.type = 'income'
        and ft.status = 'paid'
    ), 0)
  )
  else 0
end;

update public.orders
set payment_status = case
  when payment_status = 'Parcial' and amount_paid <= 0 then 'Pendente'
  when payment_status = 'Parcial' and amount_paid >= coalesce(financial_total, total) then 'Recebido'
  else payment_status
end
where payment_status = 'Parcial';

alter table public.orders
  drop constraint if exists orders_amount_paid_check,
  drop constraint if exists orders_payment_amount_check;

alter table public.orders
  add constraint orders_amount_paid_check check (
    amount_paid >= 0 and amount_paid <= coalesce(financial_total, total)
  ),
  add constraint orders_payment_amount_check check (
    (payment_status = 'Recebido' and amount_paid = coalesce(financial_total, total))
    or (payment_status = 'Parcial' and amount_paid > 0 and amount_paid < coalesce(financial_total, total))
    or (payment_status = 'Pendente' and amount_paid = 0)
    or payment_status in ('Estornado', 'Cancelado')
  );

create index if not exists orders_tenant_payment_balance
  on public.orders (tenant_id, payment_status, created_at desc)
  where payment_status in ('Pendente', 'Parcial');

-- Inclui amount_paid no fluxo protegido. Alterar o saldo diretamente exige as
-- mesmas permissoes e controle de concorrencia usados pelo ciclo do pedido.
drop trigger if exists protect_order_lifecycle_fields on public.orders;
create trigger protect_order_lifecycle_fields
before update of operational_status, payment_status, amount_paid, lifecycle_version, cancelled_at, archive_after
on public.orders
for each row execute function public.protect_order_lifecycle_fields();

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
    -- Mantem as rotinas consolidadas de CMV, cashback e compatibilidade.
    perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Pago');
    -- O lancamento agregado criado pela rotina antiga e cancelado para que a
    -- receita seja formada apenas pelas parcelas efetivamente registradas.
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
    lifecycle_version = lifecycle_version + 1,
    updated_at = now()
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

-- O valor do pedido pode ser negociado enquanto existe saldo aberto, mas nunca
-- pode ficar abaixo do que ja foi recebido. Depois da quitacao, uma mudanca de
-- total exige um fluxo de ajuste/estorno proprio para nao falsificar parcelas.
create or replace function public.adjust_tenant_order_financial_total(
  p_tenant_id uuid,
  p_order_id text,
  p_financial_total numeric,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_total numeric(12,2) := round(coalesce(p_financial_total, -1), 2);
  v_reason text := trim(coalesce(p_reason, ''));
  v_actor text := coalesce(auth.jwt()->>'email', '');
  v_updated_at timestamptz := now();
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders')
    or not public.has_tenant_permission(p_tenant_id, 'finance')
  then
    raise exception 'Acesso negado';
  end if;
  if v_total < 0 or v_total > 1000000000 then raise exception 'Valor financeiro invalido'; end if;
  if length(v_reason) < 5 or length(v_reason) > 300 then
    raise exception 'Informe um motivo entre 5 e 300 caracteres';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido nao encontrado'; end if;
  if v_order.status = 'Cancelado' then raise exception 'Pedidos cancelados nao geram receita'; end if;
  if v_total < v_order.amount_paid then raise exception 'O novo total nao pode ser menor que o valor ja recebido'; end if;
  if v_order.payment_status = 'Recebido' and v_total <> v_order.amount_paid then
    raise exception 'O pedido ja foi quitado. Use um fluxo de ajuste ou estorno para alterar o total';
  end if;

  update public.orders
  set
    financial_total = v_total,
    financial_adjustment = v_total - total,
    financial_adjustment_reason = v_reason,
    financial_adjusted_at = v_updated_at,
    financial_adjusted_by = v_actor
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'commercial_total', v_order.total,
    'financial_total', v_total,
    'financial_adjustment', v_total - v_order.total,
    'amount_paid', v_order.amount_paid,
    'remaining', v_total - v_order.amount_paid,
    'reason', v_reason,
    'adjusted_at', v_updated_at,
    'adjusted_by', v_actor
  );
end;
$$;

-- Inclui o saldo recebido na auditoria sem copiar dados pessoais do cliente.
create or replace function public.audit_safe_snapshot(p_table text, p_row jsonb)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
begin
  if p_row is null then return null; end if;

  return jsonb_strip_nulls(
    case p_table
      when 'customers' then jsonb_build_object(
        'id', p_row->'id', 'source', p_row->'source', 'tags', p_row->'tags',
        'assigned_to', p_row->'assigned_to', 'whatsapp_consent', p_row->'whatsapp_consent',
        'email_consent', p_row->'email_consent'
      )
      when 'orders' then jsonb_build_object(
        'id', p_row->'id', 'code', p_row->'code', 'customer_id', p_row->'customer_id',
        'subtotal', p_row->'subtotal', 'discount', p_row->'discount', 'shipping', p_row->'shipping',
        'total', p_row->'total', 'financial_total', p_row->'financial_total',
        'financial_adjustment', p_row->'financial_adjustment',
        'financial_adjustment_reason', p_row->'financial_adjustment_reason',
        'financial_adjusted_at', p_row->'financial_adjusted_at',
        'financial_adjusted_by', p_row->'financial_adjusted_by',
        'payment', p_row->'payment', 'status', p_row->'status',
        'operational_status', p_row->'operational_status',
        'payment_status', p_row->'payment_status', 'amount_paid', p_row->'amount_paid',
        'lifecycle_version', p_row->'lifecycle_version',
        'cancelled_at', p_row->'cancelled_at', 'archive_after', p_row->'archive_after',
        'coupon_code', p_row->'coupon_code', 'order_source', p_row->'order_source',
        'archived_at', p_row->'archived_at', 'archived_by', p_row->'archived_by'
      )
      when 'financial_transactions' then jsonb_build_object(
        'id', p_row->'id', 'type', p_row->'type', 'status', p_row->'status',
        'amount', p_row->'amount', 'category', p_row->'category', 'account', p_row->'account',
        'cost_center', p_row->'cost_center', 'order_id', p_row->'order_id',
        'purchase_order_id', p_row->'purchase_order_id', 'external_key', p_row->'external_key'
      )
      when 'suppliers' then jsonb_build_object(
        'id', p_row->'id', 'active', p_row->'active', 'lead_time_days', p_row->'lead_time_days'
      )
      when 'tenant_members' then jsonb_build_object(
        'user_id', p_row->'user_id', 'role', p_row->'role',
        'permissions', p_row->'permissions', 'active', p_row->'active'
      )
      when 'products' then jsonb_build_object(
        'id', p_row->'id', 'name', p_row->'name', 'active', p_row->'active',
        'featured', p_row->'featured', 'stock', p_row->'stock', 'price', p_row->'price'
      )
      else jsonb_build_object(
        'id', p_row->'id', 'name', p_row->'name', 'code', p_row->'code',
        'title', p_row->'title', 'active', p_row->'active',
        'status', p_row->'status', 'order_index', p_row->'order_index'
      )
    end
  );
end;
$$;

revoke all on function public.register_tenant_order_payment(uuid, text, numeric, timestamptz, integer, text) from public, anon;
grant execute on function public.register_tenant_order_payment(uuid, text, numeric, timestamptz, integer, text) to authenticated;

commit;
