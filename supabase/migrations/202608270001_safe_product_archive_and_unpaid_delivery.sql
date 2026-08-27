begin;

-- Produtos com histórico não podem ser apagados fisicamente sem quebrar
-- estoque, pedidos, lotes e auditoria. A exclusão do painel passa a ser um
-- arquivamento lógico e imediato, preservando todas as referências.
alter table public.products
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid;

create index if not exists products_tenant_not_deleted
  on public.products (tenant_id, order_index)
  where deleted_at is null;

create or replace function public.archive_tenant_product(
  p_tenant_id uuid,
  p_product_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_deleted_at timestamptz := now();
begin
  if not public.has_tenant_permission(p_tenant_id, 'catalog') then
    raise exception 'Seu usuário precisa da permissão Catálogo';
  end if;

  select * into v_product
  from public.products
  where tenant_id = p_tenant_id and id = p_product_id
  for update;

  if not found then raise exception 'Produto não encontrado'; end if;

  if v_product.deleted_at is null then
    update public.products
    set
      active = false,
      featured = false,
      slug = left(slug, 180) || '-excluido-' || left(md5(id || v_deleted_at::text), 8),
      sku = left(sku, 180) || '-EXCL-' || upper(left(md5(id || v_deleted_at::text), 8)),
      deleted_at = v_deleted_at,
      deleted_by = auth.uid(),
      updated_at = now()
    where tenant_id = p_tenant_id and id = p_product_id;
  else
    v_deleted_at := v_product.deleted_at;
  end if;

  return jsonb_build_object(
    'id', p_product_id,
    'active', false,
    'featured', false,
    'deleted_at', v_deleted_at,
    'history_preserved', true
  );
end;
$$;

revoke all on function public.archive_tenant_product(uuid, text)
  from public, anon;
grant execute on function public.archive_tenant_product(uuid, text)
  to authenticated;

-- Mesmo que uma consulta pública seja ampliada no futuro, o catálogo nunca
-- devolve um produto arquivado. Os campos de custo e estoque continuam fora
-- da view pública.
drop view if exists public.storefront_products;
create view public.storefront_products
with (security_barrier = true, security_invoker = true)
as
select
  product.tenant_id,
  product.id,
  product.slug,
  product.name,
  product.category_id,
  product.brand,
  product.price,
  product.compare_at,
  product.cashback,
  product.cashback_type,
  product.badge,
  product.accent,
  product.description,
  product.featured,
  product.active,
  product.order_index,
  product.image_url,
  product.image_urls,
  product.product_type,
  product.regulatory_status,
  product.active_ingredient,
  product.anvisa_registration,
  product.presentation,
  product.regulatory_warning,
  product.pharmacist_reviewed,
  stock_status.availability,
  stock_status.purchase_limit
from public.products product
cross join lateral public.storefront_product_availability(
  product.tenant_id,
  product.id
) stock_status
where product.active = true
  and product.deleted_at is null
  and public.is_public_tenant(product.tenant_id);

revoke all on table public.storefront_products from public, anon, authenticated;
grant select on table public.storefront_products to anon, authenticated;

-- A proteção continua impedindo preparação e envio sem pagamento. Entregar
-- com saldo em aberto é uma exceção deliberada, validada pela função segura
-- abaixo e restrita ao proprietário da operação.
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
  if new.operational_status in ('Em preparação', 'Enviado') and new.payment_status <> 'Recebido' then
    raise exception 'Confirme o pagamento antes de preparar ou enviar';
  end if;
  if new.operational_status = 'Entregue'
    and new.payment_status <> 'Recebido'
    and old.operational_status is distinct from 'Entregue'
    and not (
      auth.role() = 'service_role'
      or public.is_platform_admin()
      or exists (
        select 1 from public.tenant_members member
        where member.tenant_id = new.tenant_id
          and member.user_id = auth.uid()
          and member.active = true
          and member.role = 'owner'
      )
    )
  then
    raise exception 'Somente o proprietário pode autorizar entrega com saldo em aberto';
  end if;
  if new.payment_status in ('Estornado', 'Cancelado') and new.operational_status <> 'Cancelado' then
    raise exception 'Pagamento estornado ou cancelado exige pedido cancelado';
  end if;
  return new;
end;
$$;

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
  v_delivery_with_open_balance boolean := false;
  v_stock_movements integer := 0;
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
    if v_operation in ('Em preparação', 'Enviado') and v_payment <> 'Recebido' then
      raise exception 'Confirme o pagamento antes de preparar ou enviar';
    end if;

    v_delivery_with_open_balance := v_operation = 'Entregue' and v_payment <> 'Recebido';
    if v_delivery_with_open_balance then
      if not (
        auth.role() = 'service_role'
        or public.is_platform_admin()
        or exists (
          select 1 from public.tenant_members member
          where member.tenant_id = p_tenant_id
            and member.user_id = auth.uid()
            and member.active = true
            and member.role = 'owner'
        )
      ) then
        raise exception 'Somente o proprietário pode autorizar entrega com saldo em aberto';
      end if;
      if length(v_reason) < 5 or length(v_reason) > 300 then
        raise exception 'Explique a entrega com saldo em aberto em pelo menos 5 caracteres';
      end if;
      if v_order.operational_status is distinct from 'Entregue' then
        select public.commit_tenant_order_stock_on_payment(p_tenant_id, p_order_id)
          into v_stock_movements;
      end if;
    end if;

    if v_payment = 'Recebido' and v_order.payment_status <> 'Recebido' then
      perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Pago');
      if v_operation in ('Novo', 'Em atendimento', 'Confirmado') then
        v_operation := 'Em preparação';
      end if;
    end if;
    if v_operation = 'Entregue' and v_payment = 'Recebido' then
      perform public.update_tenant_order_status(p_tenant_id, p_order_id, 'Entregue');
    end if;
    v_cancelled_at := null;
    v_archive_after := null;
  end if;

  v_legacy_status := case
    when v_operation = 'Cancelado' then 'Cancelado'
    when v_operation = 'Entregue' and v_payment = 'Recebido' then 'Entregue'
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
      when v_delivery_with_open_balance and v_order.operational_status is distinct from 'Entregue'
        then concat_ws(E'\n', nullif(internal_notes, ''), 'Entrega com saldo em aberto: ' || v_reason)
      else internal_notes
    end
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'status', v_legacy_status,
    'operational_status', v_operation,
    'payment_status', v_payment,
    'stock_movements', v_stock_movements,
    'outstanding_balance', greatest(0, coalesce(v_order.financial_total, v_order.total) - v_order.amount_paid),
    'lifecycle_version', v_order.lifecycle_version + 1,
    'cancelled_at', v_cancelled_at,
    'archive_after', v_archive_after
  );
end;
$$;

revoke all on function public.update_tenant_order_lifecycle(uuid, text, text, text, integer, text)
  from public, anon;
grant execute on function public.update_tenant_order_lifecycle(uuid, text, text, text, integer, text)
  to authenticated;

-- Pedidos entregues com saldo em aberto continuam aceitando parcelas. A
-- quitação mantém a situação operacional como Entregue e não repete a baixa.
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
  if v_order.operational_status = 'Cancelado' then raise exception 'Este pedido nao aceita novos pagamentos'; end if;
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
  v_status := case
    when v_complete and v_order.operational_status = 'Entregue' then 'Entregue'
    when v_complete then 'Pago'
    else v_order.status
  end;

  -- Caixa e estoque fazem parte da mesma transação. Reservas já comprometidas
  -- na entrega ou em uma parcela anterior tornam esta chamada idempotente.
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
    -- A rotina consolidada cria CMV/cashback. Como as reservas já estão
    -- comprometidas, ela não baixa o estoque novamente.
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

create or replace function public.set_tenant_order_archived(
  p_tenant_id uuid,
  p_order_id text,
  p_archived boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_actor text := coalesce(auth.jwt()->>'email', '');
  v_archived_at timestamptz := case when p_archived then now() else null end;
  v_lifecycle_version integer;
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then
    raise exception 'Acesso negado';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado'; end if;
  if p_archived and v_order.operational_status not in ('Entregue', 'Cancelado') then
    raise exception 'Finalize ou cancele o pedido antes de arquivá-lo';
  end if;
  if p_archived and v_order.operational_status = 'Entregue' and v_order.payment_status <> 'Recebido' then
    raise exception 'Quite o saldo antes de arquivar este pedido entregue';
  end if;

  if p_archived then
    update public.orders
    set archived_at = v_archived_at, archived_by = v_actor
    where tenant_id = p_tenant_id and id = p_order_id
    returning lifecycle_version into v_lifecycle_version;
  else
    update public.orders
    set
      archived_at = null,
      archived_by = '',
      archive_after = null,
      lifecycle_version = lifecycle_version + 1
    where tenant_id = p_tenant_id and id = p_order_id
    returning lifecycle_version into v_lifecycle_version;
  end if;

  return jsonb_build_object(
    'id', p_order_id,
    'archived_at', v_archived_at,
    'archived_by', case when p_archived then v_actor else '' end,
    'archive_after', case when p_archived then v_order.archive_after else null end,
    'lifecycle_version', v_lifecycle_version
  );
end;
$$;

revoke all on function public.set_tenant_order_archived(uuid, text, boolean)
  from public, anon;
grant execute on function public.set_tenant_order_archived(uuid, text, boolean)
  to authenticated;

-- O funil acompanha a situação operacional, inclusive quando o status legado
-- permanece Novo para não reconhecer receita antes do pagamento.
create or replace function public.sync_order_funnel_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stage text;
begin
  if new.funnel_session_id is null then return new; end if;
  if new.payment_status = 'Parcial' and old.payment_status is distinct from 'Parcial' then v_stage := 'partial_payment'; end if;
  if new.payment_status = 'Recebido' and old.payment_status is distinct from 'Recebido' then v_stage := 'paid'; end if;
  if new.operational_status = 'Entregue' and old.operational_status is distinct from 'Entregue' then v_stage := 'delivered'; end if;
  if v_stage is null then return new; end if;

  insert into public.storefront_funnel_events (
    tenant_id, session_id, event_key, stage, order_id, customer_id, source, properties
  ) values (
    new.tenant_id, new.funnel_session_id, v_stage || ':' || new.id,
    v_stage, new.id, new.customer_id, new.attribution,
    jsonb_build_object('amount_paid', new.amount_paid, 'total', coalesce(new.financial_total, new.total))
  ) on conflict (tenant_id, session_id, event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists sync_order_funnel_event on public.orders;
create trigger sync_order_funnel_event
after update of payment_status, status, operational_status on public.orders
for each row execute function public.sync_order_funnel_event();

notify pgrst, 'reload schema';

commit;
