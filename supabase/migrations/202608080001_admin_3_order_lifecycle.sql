begin;

-- ADMIN 3.0: a situação operacional, o pagamento e a visibilidade passam a
-- ser dimensões independentes. `status` continua sincronizado como camada de
-- compatibilidade para as rotinas consolidadas de estoque, caixa e cashback.
alter table public.orders
  add column if not exists operational_status text not null default 'Novo',
  add column if not exists payment_status text not null default 'Pendente',
  add column if not exists lifecycle_version integer not null default 1,
  add column if not exists cancelled_at timestamptz,
  add column if not exists archive_after timestamptz;

alter table public.orders
  drop constraint if exists orders_operational_status_check,
  drop constraint if exists orders_payment_status_check,
  drop constraint if exists orders_lifecycle_version_check;

alter table public.orders
  add constraint orders_operational_status_check check (operational_status in (
    'Novo', 'Em atendimento', 'Confirmado', 'Em preparação', 'Enviado', 'Entregue', 'Cancelado'
  )),
  add constraint orders_payment_status_check check (payment_status in (
    'Pendente', 'Recebido', 'Parcial', 'Estornado', 'Cancelado'
  )),
  add constraint orders_lifecycle_version_check check (lifecycle_version > 0);

update public.orders o
set
  operational_status = case o.status
    when 'Pago' then 'Em preparação'
    when 'Entregue' then 'Entregue'
    when 'Cancelado' then 'Cancelado'
    else 'Novo'
  end,
  payment_status = case
    when o.status in ('Pago', 'Entregue') then 'Recebido'
    when o.status = 'Cancelado' and exists (
      select 1 from public.financial_transactions ft
      where ft.tenant_id = o.tenant_id and ft.order_id = o.id and ft.type = 'income'
    ) then 'Estornado'
    when o.status = 'Cancelado' then 'Cancelado'
    else 'Pendente'
  end,
  cancelled_at = case when o.status = 'Cancelado' then coalesce(o.cancelled_at, o.created_at) else null end,
  archive_after = case when o.status = 'Cancelado' then coalesce(o.archive_after, o.created_at + interval '7 days') else null end;

create index if not exists orders_tenant_lifecycle_created
  on public.orders (tenant_id, operational_status, payment_status, created_at desc);
create index if not exists orders_tenant_archive_after
  on public.orders (tenant_id, archive_after)
  where archived_at is null and archive_after is not null;

create or replace function public.protect_order_lifecycle_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_tenant_permission(new.tenant_id, 'orders') then
    raise exception 'Acesso negado ao ciclo do pedido';
  end if;

  if new.payment_status is distinct from old.payment_status
    and (new.payment_status in ('Recebido', 'Parcial', 'Estornado')
      or old.payment_status in ('Recebido', 'Parcial'))
    and not public.has_tenant_permission(new.tenant_id, 'finance')
  then
    raise exception 'Acesso financeiro necessário';
  end if;

  if new.lifecycle_version <> old.lifecycle_version + 1 then
    raise exception 'Use o fluxo seguro para alterar o pedido';
  end if;
  if new.operational_status in ('Em preparação', 'Enviado', 'Entregue') and new.payment_status <> 'Recebido' then
    raise exception 'Confirme o pagamento antes de preparar ou entregar';
  end if;
  if new.payment_status in ('Estornado', 'Cancelado') and new.operational_status <> 'Cancelado' then
    raise exception 'Pagamento estornado ou cancelado exige pedido cancelado';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_order_lifecycle_fields on public.orders;
create trigger protect_order_lifecycle_fields
before update of operational_status, payment_status, lifecycle_version, cancelled_at, archive_after
on public.orders
for each row execute function public.protect_order_lifecycle_fields();

create or replace function public.update_tenant_order_lifecycle(
  p_tenant_id uuid,
  p_order_id text,
  p_operational_status text,
  p_payment_status text,
  p_expected_version integer,
  p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_operation text := trim(coalesce(p_operational_status, ''));
  v_payment text := trim(coalesce(p_payment_status, ''));
  v_reason text := trim(coalesce(p_reason, ''));
  v_legacy_status text;
  v_cancelled_at timestamptz;
  v_archive_after timestamptz;
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then
    raise exception 'Acesso negado';
  end if;
  if v_operation not in ('Novo', 'Em atendimento', 'Confirmado', 'Em preparação', 'Enviado', 'Entregue', 'Cancelado') then
    raise exception 'Situação do pedido inválida';
  end if;
  if v_payment not in ('Pendente', 'Recebido', 'Parcial', 'Estornado', 'Cancelado') then
    raise exception 'Situação do pagamento inválida';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.archived_at is not null then raise exception 'Restaure o pedido antes de alterá-lo'; end if;
  if v_order.status = 'Cancelado' and v_operation <> 'Cancelado' then
    raise exception 'Pedido cancelado não pode ser reaberto; crie um novo pedido';
  end if;
  if coalesce(p_expected_version, 0) <> v_order.lifecycle_version then
    raise exception 'Este pedido foi alterado em outra tela. Atualize e tente novamente';
  end if;

  if v_payment is distinct from v_order.payment_status
    and (v_payment in ('Recebido', 'Parcial', 'Estornado')
      or v_order.payment_status in ('Recebido', 'Parcial'))
    and not public.has_tenant_permission(p_tenant_id, 'finance')
  then
    raise exception 'Seu usuário precisa da permissão Financeiro';
  end if;

  if v_operation = 'Cancelado' then
    if length(v_reason) < 5 or length(v_reason) > 300 then
      raise exception 'Explique o cancelamento em pelo menos 5 caracteres';
    end if;
    v_payment := case
      when v_order.payment_status in ('Recebido', 'Parcial') or v_payment = 'Estornado' then 'Estornado'
      else 'Cancelado'
    end;
    perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Cancelado');
    v_cancelled_at := now();
    v_archive_after := now() + interval '7 days';
  else
    if v_payment in ('Estornado', 'Cancelado') then
      raise exception 'Para estornar ou cancelar o pagamento, cancele também o pedido';
    end if;
    if v_operation in ('Em preparação', 'Enviado', 'Entregue') and v_payment <> 'Recebido' then
      raise exception 'Confirme o pagamento antes de preparar ou entregar';
    end if;
    if v_payment = 'Recebido' and v_order.payment_status <> 'Recebido' then
      perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Pago');
      if v_operation in ('Novo', 'Em atendimento', 'Confirmado') then
        v_operation := 'Em preparação';
      end if;
    end if;
    if v_operation = 'Entregue' then
      perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Entregue');
    end if;
    v_cancelled_at := null;
    v_archive_after := null;
  end if;

  v_legacy_status := case
    when v_operation = 'Cancelado' then 'Cancelado'
    when v_operation = 'Entregue' then 'Entregue'
    when v_payment = 'Recebido' then 'Pago'
    else 'Novo'
  end;

  update public.orders
  set
    status = v_legacy_status,
    operational_status = v_operation,
    payment_status = v_payment,
    lifecycle_version = lifecycle_version + 1,
    cancelled_at = v_cancelled_at,
    archive_after = v_archive_after,
    internal_notes = case
      when v_operation = 'Cancelado' then concat_ws(E'\n', nullif(internal_notes, ''), 'Cancelamento: ' || v_reason)
      else internal_notes
    end
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'status', v_legacy_status,
    'operational_status', v_operation,
    'payment_status', v_payment,
    'lifecycle_version', v_order.lifecycle_version + 1,
    'cancelled_at', v_cancelled_at,
    'archive_after', v_archive_after
  );
end;
$$;

-- Inclui as novas dimensões na auditoria sem copiar nome, telefone, e-mail ou
-- endereço do cliente.
create or replace function public.audit_safe_snapshot(p_table text, p_row jsonb)
returns jsonb
language plpgsql
immutable
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
        'payment_status', p_row->'payment_status',
        'lifecycle_version', p_row->'lifecycle_version',
        'cancelled_at', p_row->'cancelled_at', 'archive_after', p_row->'archive_after',
        'coupon_code', p_row->'coupon_code', 'order_source', p_row->'order_source',
        'archived_at', p_row->'archived_at', 'archived_by', p_row->'archived_by'
      )
      when 'financial_transactions' then jsonb_build_object(
        'id', p_row->'id', 'type', p_row->'type', 'status', p_row->'status',
        'amount', p_row->'amount', 'category', p_row->'category', 'account', p_row->'account',
        'cost_center', p_row->'cost_center', 'order_id', p_row->'order_id',
        'purchase_order_id', p_row->'purchase_order_id'
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

revoke all on function public.update_tenant_order_lifecycle(uuid, text, text, text, integer, text) from public, anon;
grant execute on function public.update_tenant_order_lifecycle(uuid, text, text, text, integer, text) to authenticated;

commit;
