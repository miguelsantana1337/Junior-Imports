begin;

-- Mantém a autoria da decisão separada do solicitante e do revisor indicado.
alter table public.approval_requests
  add column if not exists decided_by uuid references auth.users(id) on delete set null,
  add column if not exists decided_by_email text not null default '';

-- Confirmações duráveis impedem que uma menção já aberta volte para a caixa de entrada.
create table if not exists public.collaboration_reads (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id text not null references public.collaboration_comments(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (tenant_id, user_id, comment_id)
);

create index if not exists collaboration_reads_user_recent
  on public.collaboration_reads (tenant_id, user_id, read_at desc);

-- Cria a discussão e a primeira mensagem na mesma transação.
create or replace function public.create_collaboration_thread(
  p_tenant_id uuid,
  p_thread_id text,
  p_comment_id text,
  p_title text,
  p_entity_type text,
  p_entity_id text,
  p_entity_label text,
  p_priority text,
  p_body text,
  p_mentions text[] default '{}'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text := '';
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'collaboration') then
    raise exception 'Acesso negado';
  end if;

  select coalesce(email, '') into v_actor_email
  from public.profiles
  where id = auth.uid();

  insert into public.collaboration_threads
    (tenant_id, id, title, entity_type, entity_id, entity_label, status, priority, created_by, created_by_email)
  values
    (p_tenant_id, p_thread_id, trim(p_title), p_entity_type, coalesce(p_entity_id, ''), coalesce(p_entity_label, ''), 'open', p_priority, auth.uid(), v_actor_email);

  insert into public.collaboration_comments
    (tenant_id, id, thread_id, body, mentions, actor_id, actor_email)
  values
    (p_tenant_id, p_comment_id, p_thread_id, trim(p_body), coalesce(p_mentions, '{}'), auth.uid(), v_actor_email);

  return jsonb_build_object('threadId', p_thread_id, 'commentId', p_comment_id);
end;
$$;

-- Publica a resposta e atualiza a atividade da discussão em uma única transação.
create or replace function public.create_collaboration_comment(
  p_tenant_id uuid,
  p_comment_id text,
  p_thread_id text,
  p_body text,
  p_mentions text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text := '';
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'collaboration') then
    raise exception 'Acesso negado';
  end if;
  if not exists(
    select 1 from public.collaboration_threads
    where tenant_id = p_tenant_id and id = p_thread_id
  ) then raise exception 'Discussão não encontrada'; end if;

  select coalesce(email, '') into v_actor_email
  from public.profiles
  where id = auth.uid();

  insert into public.collaboration_comments
    (tenant_id, id, thread_id, body, mentions, actor_id, actor_email)
  values
    (p_tenant_id, p_comment_id, p_thread_id, trim(p_body), coalesce(p_mentions, '{}'),
     auth.uid(), v_actor_email);

  update public.collaboration_threads
  set updated_at = now()
  where tenant_id = p_tenant_id and id = p_thread_id;
end;
$$;

-- Alterações de estado da discussão ficam limitadas ao campo permitido.
create or replace function public.set_collaboration_thread_status(
  p_tenant_id uuid,
  p_thread_id text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'collaboration') then
    raise exception 'Acesso negado';
  end if;
  if p_status not in ('open', 'resolved', 'archived') then
    raise exception 'Status inválido';
  end if;

  update public.collaboration_threads
  set status = p_status
  where tenant_id = p_tenant_id and id = p_thread_id;

  if not found then raise exception 'Discussão não encontrada'; end if;
end;
$$;

-- A autoria e o revisor são validados no servidor antes da solicitação existir.
create or replace function public.create_approval_request(
  p_tenant_id uuid,
  p_id text,
  p_thread_id text,
  p_entity_type text,
  p_entity_id text,
  p_entity_label text,
  p_request_note text default '',
  p_reviewer_email text default '',
  p_due_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_email text := '';
  v_reviewer_email text := lower(trim(coalesce(p_reviewer_email, '')));
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'collaboration') then
    raise exception 'Acesso negado';
  end if;
  if p_entity_type not in ('product', 'customer', 'order', 'publication', 'report', 'purchase')
    or trim(coalesce(p_entity_id, '')) = ''
    or trim(coalesce(p_entity_label, '')) = '' then
    raise exception 'Item de aprovação inválido';
  end if;
  if nullif(trim(coalesce(p_thread_id, '')), '') is not null and not exists(
    select 1 from public.collaboration_threads
    where tenant_id = p_tenant_id and id = p_thread_id
  ) then raise exception 'Discussão inválida'; end if;
  if v_reviewer_email <> '' and not exists(
    select 1
    from public.tenant_members member
    join public.profiles profile on profile.id = member.user_id
    where member.tenant_id = p_tenant_id
      and member.active = true
      and profile.active = true
      and lower(profile.email) = v_reviewer_email
      and (member.role = 'owner' or 'collaboration' = any(member.permissions))
  ) then raise exception 'Revisor inválido'; end if;

  select coalesce(email, '') into v_actor_email
  from public.profiles
  where id = auth.uid();

  insert into public.approval_requests
    (tenant_id, id, thread_id, entity_type, entity_id, entity_label, request_note,
     requested_by, requested_by_email, reviewer_email, due_at)
  values
    (p_tenant_id, p_id, nullif(trim(coalesce(p_thread_id, '')), ''), p_entity_type,
     trim(p_entity_id), trim(p_entity_label), trim(coalesce(p_request_note, '')),
     auth.uid(), v_actor_email, v_reviewer_email, p_due_at);
end;
$$;

-- A decisão passa pelo banco: apenas o revisor indicado ou um gerente pode decidir.
create or replace function public.decide_approval(
  p_tenant_id uuid,
  p_approval_id text,
  p_status text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.approval_requests%rowtype;
  v_actor_email text := '';
  v_privileged boolean := false;
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'collaboration') then
    raise exception 'Acesso negado';
  end if;
  if p_status not in ('approved', 'rejected') then
    raise exception 'Decisão inválida';
  end if;
  if p_status = 'rejected' and char_length(trim(coalesce(p_note, ''))) < 2 then
    raise exception 'Informe o motivo da rejeição';
  end if;

  select * into v_request
  from public.approval_requests
  where tenant_id = p_tenant_id and id = p_approval_id
  for update;

  if not found then raise exception 'Solicitação não encontrada'; end if;
  if v_request.status <> 'pending' then raise exception 'Esta solicitação já foi decidida'; end if;

  select coalesce(email, '') into v_actor_email
  from public.profiles
  where id = auth.uid();

  v_privileged := public.is_platform_admin() or exists(
    select 1
    from public.tenant_members
    where tenant_id = p_tenant_id
      and user_id = auth.uid()
      and active = true
      and role in ('owner', 'manager')
  );

  if v_request.requested_by = auth.uid() and not v_privileged then
    raise exception 'O solicitante não pode decidir a própria aprovação';
  end if;
  if trim(v_request.reviewer_email) <> ''
    and lower(trim(v_request.reviewer_email)) <> lower(trim(v_actor_email))
    and not v_privileged then
    raise exception 'Esta decisão pertence ao revisor indicado';
  end if;

  update public.approval_requests
  set status = p_status,
      decision_note = trim(coalesce(p_note, '')),
      decided_at = now(),
      decided_by = auth.uid(),
      decided_by_email = v_actor_email,
      updated_at = now()
  where tenant_id = p_tenant_id and id = p_approval_id;

  return jsonb_build_object(
    'id', p_approval_id,
    'status', p_status,
    'decidedAt', now(),
    'decidedByEmail', v_actor_email
  );
end;
$$;

-- Salva cabeçalho e itens da ordem de compra atomicamente e recalcula o total no banco.
create or replace function public.save_purchase_order(
  p_tenant_id uuid,
  p_order jsonb,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_order_id text := trim(coalesce(p_order->>'id', ''));
  v_code text := trim(coalesce(p_order->>'code', ''));
  v_supplier_id text := nullif(trim(coalesce(p_order->>'supplierId', '')), '');
  v_status text := coalesce(nullif(trim(p_order->>'status'), ''), 'draft');
  v_product_name text;
  v_total numeric(12,2) := 0;
begin
  if auth.uid() is null or not public.has_tenant_permission(p_tenant_id, 'purchasing') then
    raise exception 'Acesso negado';
  end if;
  if v_order_id = '' or v_code = '' then raise exception 'Ordem de compra inválida'; end if;
  if v_status not in ('draft', 'ordered', 'partial', 'received', 'cancelled') then raise exception 'Status inválido'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'Itens inválidos'; end if;
  if exists(select 1 from public.purchase_orders where id = v_order_id and tenant_id <> p_tenant_id) then
    raise exception 'Identificador de ordem indisponível';
  end if;
  if v_supplier_id is not null and not exists(
    select 1 from public.suppliers where tenant_id = p_tenant_id and id = v_supplier_id
  ) then raise exception 'Fornecedor inválido'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if coalesce((v_item->>'quantity')::integer, 0) <= 0 or coalesce((v_item->>'unitCost')::numeric, -1) < 0 then
      raise exception 'Quantidade ou custo inválido';
    end if;
    select name into v_product_name
    from public.products
    where tenant_id = p_tenant_id and id = v_item->>'productId';
    if not found then raise exception 'Produto inválido'; end if;
    v_total := v_total + ((v_item->>'quantity')::integer * (v_item->>'unitCost')::numeric);
  end loop;

  insert into public.purchase_orders
    (tenant_id, id, code, supplier_id, status, expected_at, received_at, total, notes, created_at, updated_at)
  values
    (p_tenant_id, v_order_id, v_code, v_supplier_id, v_status,
     nullif(p_order->>'expectedAt', '')::date,
     nullif(p_order->>'receivedAt', '')::timestamptz,
     v_total, coalesce(p_order->>'notes', ''),
     coalesce(nullif(p_order->>'createdAt', '')::timestamptz, now()), now())
  on conflict (id) do update set
    code = excluded.code,
    supplier_id = excluded.supplier_id,
    status = excluded.status,
    expected_at = excluded.expected_at,
    received_at = excluded.received_at,
    total = excluded.total,
    notes = excluded.notes,
    updated_at = now();

  delete from public.purchase_order_items
  where tenant_id = p_tenant_id and purchase_order_id = v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select name into v_product_name
    from public.products
    where tenant_id = p_tenant_id and id = v_item->>'productId';

    insert into public.purchase_order_items
      (tenant_id, id, purchase_order_id, product_id, product_name, quantity, unit_cost, lot_code, expiry_date)
    values
      (p_tenant_id, trim(v_item->>'id'), v_order_id, trim(v_item->>'productId'), v_product_name,
       (v_item->>'quantity')::integer, (v_item->>'unitCost')::numeric,
       coalesce(v_item->>'lotCode', ''), nullif(v_item->>'expiryDate', '')::date);
  end loop;

  return jsonb_build_object('id', v_order_id, 'total', v_total, 'itemCount', jsonb_array_length(p_items));
end;
$$;

drop policy if exists "tenant approvals manage" on public.approval_requests;
drop policy if exists "tenant approvals read" on public.approval_requests;
drop policy if exists "tenant approvals create" on public.approval_requests;
create policy "tenant approvals read" on public.approval_requests for select to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'));
drop policy if exists "tenant collaboration threads manage" on public.collaboration_threads;
drop policy if exists "tenant collaboration threads read" on public.collaboration_threads;
create policy "tenant collaboration threads read" on public.collaboration_threads for select to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'));

drop policy if exists "tenant collaboration comments manage" on public.collaboration_comments;
drop policy if exists "tenant collaboration comments read" on public.collaboration_comments;
drop policy if exists "tenant collaboration comments create" on public.collaboration_comments;
create policy "tenant collaboration comments read" on public.collaboration_comments for select to authenticated
using (public.has_tenant_permission(tenant_id, 'collaboration'));

alter table public.collaboration_reads enable row level security;
drop policy if exists "own collaboration reads" on public.collaboration_reads;
create policy "own collaboration reads" on public.collaboration_reads for all to authenticated
using (user_id = auth.uid() and public.has_tenant_permission(tenant_id, 'collaboration'))
with check (
  user_id = auth.uid()
  and public.has_tenant_permission(tenant_id, 'collaboration')
  and exists (
    select 1 from public.collaboration_comments comment
    where comment.id = collaboration_reads.comment_id
      and comment.tenant_id = collaboration_reads.tenant_id
  )
);

revoke insert, update, delete on public.collaboration_threads from authenticated;
revoke insert, update, delete on public.collaboration_comments from authenticated;
revoke insert, update, delete on public.approval_requests from authenticated;
grant select on public.collaboration_threads, public.approval_requests to authenticated;
grant select on public.collaboration_comments to authenticated;
grant select, insert, update on public.collaboration_reads to authenticated;

revoke all on function public.create_collaboration_thread(uuid, text, text, text, text, text, text, text, text, text[]) from public, anon;
revoke all on function public.create_collaboration_comment(uuid, text, text, text, text[]) from public, anon;
revoke all on function public.set_collaboration_thread_status(uuid, text, text) from public, anon;
revoke all on function public.create_approval_request(uuid, text, text, text, text, text, text, text, timestamptz) from public, anon;
revoke all on function public.decide_approval(uuid, text, text, text) from public, anon;
revoke all on function public.save_purchase_order(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.create_collaboration_thread(uuid, text, text, text, text, text, text, text, text, text[]) to authenticated;
grant execute on function public.create_collaboration_comment(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.set_collaboration_thread_status(uuid, text, text) to authenticated;
grant execute on function public.create_approval_request(uuid, text, text, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.decide_approval(uuid, text, text, text) to authenticated;
grant execute on function public.save_purchase_order(uuid, jsonb, jsonb) to authenticated;

commit;
