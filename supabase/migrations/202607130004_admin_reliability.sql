create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text not null default '',
  action text not null check (action in ('insert', 'update', 'delete')),
  entity_type text not null,
  entity_id text not null default '',
  entity_label text not null default '',
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity on public.audit_logs (entity_type, entity_id);

alter table public.audit_logs enable row level security;

drop policy if exists "staff audit logs read" on public.audit_logs;
create policy "staff audit logs read" on public.audit_logs for select to authenticated
using (public.has_admin_permission('dashboard'));

create or replace function public.capture_admin_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  actor_mail text := '';
  previous_row jsonb;
  current_row jsonb;
  row_data jsonb;
  item_id text;
  item_label text;
begin
  if actor is null then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  select email into actor_mail from public.profiles where id = actor;
  previous_row := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  current_row := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  row_data := coalesce(current_row, previous_row, '{}'::jsonb);
  item_id := coalesce(row_data->>'id', '');
  item_label := coalesce(
    nullif(row_data->>'name', ''),
    nullif(row_data->>'code', ''),
    nullif(row_data->>'title', ''),
    nullif(row_data->>'store_name', ''),
    nullif(row_data->>'email', ''),
    nullif(row_data->>'slug', ''),
    item_id
  );

  insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, entity_label, before_data, after_data)
  values (actor, coalesce(actor_mail, ''), lower(tg_op), tg_table_name, item_id, item_label, previous_row, current_row);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'store_settings', 'categories', 'products', 'banners', 'home_sections',
    'coupons', 'trust_items', 'benefits', 'faqs', 'store_pages', 'page_blocks',
    'message_automations', 'orders'
  ] loop
    execute format('drop trigger if exists admin_audit_change on public.%I', table_name);
    execute format('create trigger admin_audit_change after insert or update or delete on public.%I for each row execute function public.capture_admin_audit()', table_name);
  end loop;
end;
$$;

create or replace function public.reorder_admin_items(p_table text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  required_permission text;
  item jsonb;
begin
  required_permission := case
    when p_table in ('products', 'categories') then 'catalog'
    when p_table in ('banners', 'home_sections', 'store_pages', 'page_blocks') then 'store'
    else null
  end;

  if required_permission is null then raise exception 'Tabela não permitida'; end if;
  if not public.has_admin_permission(required_permission) then raise exception 'Acesso negado'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 500 then raise exception 'Ordenação inválida'; end if;

  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce(item->>'id', '') = '' then raise exception 'Item inválido'; end if;
    execute format('update public.%I set order_index = $1 where id = $2', p_table)
      using greatest(0, (item->>'order')::integer), item->>'id';
  end loop;
end;
$$;

grant execute on function public.reorder_admin_items(text, jsonb) to authenticated;

create or replace function public.queue_order_status_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  automation public.message_automations%rowtype;
  rendered_subject text;
  rendered_message text;
begin
  if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;

  for automation in select * from public.message_automations where active = true and trigger_status = new.status loop
    rendered_subject := replace(replace(replace(replace(automation.subject, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    rendered_message := replace(replace(replace(replace(automation.message, '{{cliente}}', coalesce(new.customer->>'name', 'Cliente')), '{{pedido}}', new.code), '{{status}}', new.status), '{{total}}', 'R$ ' || replace(to_char(new.total, 'FM999G999G990D00'), '.', ','));
    insert into public.message_logs (order_id, order_code, automation_id, automation_name, channel, recipient, subject, message, status)
    values (new.id, new.code, automation.id, automation.name, automation.channel, case when automation.channel = 'whatsapp' then coalesce(new.customer->>'phone', '') else coalesce(new.customer->>'email', '') end, rendered_subject, rendered_message, 'simulated');
  end loop;
  return new;
end;
$$;

drop trigger if exists on_demo_order_created_message on public.orders;
drop trigger if exists on_demo_order_status_message on public.orders;
create trigger on_demo_order_status_message
after insert or update on public.orders
for each row execute function public.queue_order_status_message();

create or replace function public.update_demo_order_status(p_order_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_admin_permission('orders') then raise exception 'Acesso negado'; end if;
  if p_status not in ('Novo', 'Aguardando pagamento', 'Pago', 'Preparando', 'Enviado', 'Entregue', 'Cancelado') then raise exception 'Status inválido'; end if;
  update public.orders set status = p_status where id = p_order_id;
  if not found then raise exception 'Pedido não encontrado'; end if;
end;
$$;

grant execute on function public.update_demo_order_status(text, text) to authenticated;

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']::text[]
where id in ('product-media', 'banner-media', 'site-media');
