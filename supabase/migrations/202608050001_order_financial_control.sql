begin;

-- O total comercial permanece imutável para preservar checkout, cashback e
-- comunicação com o cliente. Ajustes operacionais vivem em campos próprios.
alter table public.orders
  add column if not exists financial_total numeric(12,2),
  add column if not exists financial_adjustment numeric(12,2) not null default 0,
  add column if not exists financial_adjustment_reason text not null default '',
  add column if not exists financial_adjusted_at timestamptz,
  add column if not exists financial_adjusted_by text not null default '',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by text not null default '';

update public.orders
set
  financial_total = total,
  financial_adjustment = 0
where financial_total is null;

alter table public.orders
  alter column financial_total set not null,
  add constraint orders_financial_total_check check (financial_total >= 0),
  add constraint orders_financial_adjustment_reason_check check (length(financial_adjustment_reason) <= 300);

create index if not exists orders_tenant_archived_created
  on public.orders (tenant_id, archived_at, created_at desc);

create or replace function public.initialize_order_financial_total()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.financial_total is null then
    new.financial_total := new.total;
  elsif new.financial_total is distinct from new.total then
    if not public.has_tenant_permission(new.tenant_id, 'finance') then
      raise exception 'Acesso negado ao ajuste financeiro';
    end if;
    if length(trim(coalesce(new.financial_adjustment_reason, ''))) < 5
      or length(new.financial_adjustment_reason) > 300
    then
      raise exception 'Informe um motivo entre 5 e 300 caracteres';
    end if;
    new.financial_adjusted_at := now();
    new.financial_adjusted_by := coalesce(auth.jwt()->>'email', '');
  end if;
  new.financial_adjustment := new.financial_total - new.total;
  return new;
end;
$$;

drop trigger if exists initialize_order_financial_total on public.orders;
create trigger initialize_order_financial_total
before insert on public.orders
for each row execute function public.initialize_order_financial_total();

-- Mesmo que alguém tente contornar a interface e atualizar a tabela
-- diretamente, as regras de permissão e consistência continuam valendo.
create or replace function public.protect_order_control_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor text := coalesce(auth.jwt()->>'email', '');
begin
  if new.financial_total is distinct from old.financial_total then
    if not public.has_tenant_permission(new.tenant_id, 'finance') then
      raise exception 'Acesso negado ao ajuste financeiro';
    end if;
    if new.financial_total < 0 or new.financial_total > 1000000000 then
      raise exception 'Valor financeiro inválido';
    end if;
    if length(trim(coalesce(new.financial_adjustment_reason, ''))) < 5
      or length(new.financial_adjustment_reason) > 300
    then
      raise exception 'Informe um motivo entre 5 e 300 caracteres';
    end if;
    new.financial_adjustment := new.financial_total - new.total;
    new.financial_adjusted_at := now();
    new.financial_adjusted_by := v_actor;
  elsif new.financial_adjustment is distinct from old.financial_adjustment
    or new.financial_adjustment_reason is distinct from old.financial_adjustment_reason
    or new.financial_adjusted_at is distinct from old.financial_adjusted_at
    or new.financial_adjusted_by is distinct from old.financial_adjusted_by
  then
    raise exception 'Use o ajuste financeiro do pedido';
  end if;

  if new.archived_at is distinct from old.archived_at then
    if not public.has_tenant_permission(new.tenant_id, 'orders') then
      raise exception 'Acesso negado ao arquivo de pedidos';
    end if;
    if new.archived_at is not null and new.status not in ('Entregue', 'Cancelado') then
      raise exception 'Finalize ou cancele o pedido antes de arquivá-lo';
    end if;
    new.archived_by := case when new.archived_at is null then '' else v_actor end;
  elsif new.archived_by is distinct from old.archived_by then
    raise exception 'Use o arquivo de pedidos';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_order_control_fields on public.orders;
create trigger protect_order_control_fields
before update of financial_total, financial_adjustment, financial_adjustment_reason,
  financial_adjusted_at, financial_adjusted_by, archived_at, archived_by
on public.orders
for each row execute function public.protect_order_control_fields();

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
  v_reason text := trim(coalesce(p_reason, ''));
  v_actor text := coalesce(auth.jwt()->>'email', '');
  v_updated_at timestamptz := now();
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders')
    or not public.has_tenant_permission(p_tenant_id, 'finance')
  then
    raise exception 'Acesso negado';
  end if;

  if p_financial_total is null or p_financial_total < 0 or p_financial_total > 1000000000 then
    raise exception 'Valor financeiro inválido';
  end if;
  if length(v_reason) < 5 or length(v_reason) > 300 then
    raise exception 'Informe um motivo entre 5 e 300 caracteres';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado'; end if;
  if v_order.status = 'Cancelado' then
    raise exception 'Pedidos cancelados não geram receita';
  end if;

  update public.orders
  set
    financial_total = round(p_financial_total, 2),
    financial_adjustment = round(p_financial_total, 2) - total,
    financial_adjustment_reason = v_reason,
    financial_adjusted_at = v_updated_at,
    financial_adjusted_by = v_actor
  where tenant_id = p_tenant_id and id = p_order_id;

  if v_order.status in ('Pago', 'Entregue') then
    update public.financial_transactions
    set
      amount = round(p_financial_total, 2),
      status = 'paid',
      notes = 'Valor financeiro ajustado no pedido. Motivo: ' || v_reason,
      updated_at = v_updated_at
    where tenant_id = p_tenant_id
      and order_id = p_order_id
      and type = 'income';

    if not found then
      insert into public.financial_transactions
        (tenant_id, id, type, status, description, amount, category, account, cost_center,
         due_date, paid_at, order_id, notes, external_key, created_at)
      values
        (p_tenant_id, 'order-income-' || p_order_id, 'income', 'paid', 'Venda ' || v_order.code,
         round(p_financial_total, 2), 'Vendas', 'Conta principal', 'Comercial',
         v_order.created_at::date, v_updated_at, p_order_id,
         'Valor financeiro ajustado no pedido. Motivo: ' || v_reason,
         'order-income:' || p_order_id, v_order.created_at)
      on conflict (tenant_id, external_key) where external_key <> ''
      do update set
        amount = excluded.amount,
        status = 'paid',
        notes = excluded.notes,
        paid_at = excluded.paid_at,
        updated_at = v_updated_at;
    end if;
  end if;

  return jsonb_build_object(
    'id', p_order_id,
    'commercial_total', v_order.total,
    'financial_total', round(p_financial_total, 2),
    'financial_adjustment', round(p_financial_total, 2) - v_order.total,
    'reason', v_reason,
    'adjusted_at', v_updated_at,
    'adjusted_by', v_actor
  );
end;
$$;

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
begin
  if not public.has_tenant_permission(p_tenant_id, 'orders') then
    raise exception 'Acesso negado';
  end if;

  select * into v_order
  from public.orders
  where tenant_id = p_tenant_id and id = p_order_id
  for update;

  if not found then raise exception 'Pedido não encontrado'; end if;
  if p_archived and v_order.status not in ('Entregue', 'Cancelado') then
    raise exception 'Finalize ou cancele o pedido antes de arquivá-lo';
  end if;

  update public.orders
  set
    archived_at = v_archived_at,
    archived_by = case when p_archived then v_actor else '' end
  where tenant_id = p_tenant_id and id = p_order_id;

  return jsonb_build_object(
    'id', p_order_id,
    'archived_at', v_archived_at,
    'archived_by', case when p_archived then v_actor else '' end
  );
end;
$$;

-- Garante que a confirmação direta como Entregue também gere receita e que
-- qualquer confirmação futura use o total financeiro, não o comercial.
do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.update_tenant_order_status(uuid,text,text)'::regprocedure
  ) into current_definition;

  updated_definition := replace(
    current_definition,
    'elsif p_status = ''Pago'' and v_order.status <> ''Pago'' then',
    'elsif p_status in (''Pago'', ''Entregue'') and v_order.status not in (''Pago'', ''Entregue'') then'
  );
  updated_definition := replace(
    updated_definition,
    'v_order.total, ''Vendas''',
    'coalesce(v_order.financial_total, v_order.total), ''Vendas'''
  );

  if updated_definition = current_definition
    or position('coalesce(v_order.financial_total, v_order.total)' in updated_definition) = 0
    or position('p_status in (''Pago'', ''Entregue'') and v_order.status not in (''Pago'', ''Entregue'')' in updated_definition) = 0
  then
    raise exception 'Não foi possível atualizar o controle financeiro de update_tenant_order_status';
  end if;

  execute updated_definition;
end;
$$;

-- A auditoria registra somente os campos necessários para explicar o ajuste e
-- o arquivamento, sem copiar dados pessoais do cliente.
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

revoke all on function public.adjust_tenant_order_financial_total(uuid, text, numeric, text) from public, anon;
revoke all on function public.set_tenant_order_archived(uuid, text, boolean) from public, anon;
grant execute on function public.adjust_tenant_order_financial_total(uuid, text, numeric, text) to authenticated;
grant execute on function public.set_tenant_order_archived(uuid, text, boolean) to authenticated;

commit;
