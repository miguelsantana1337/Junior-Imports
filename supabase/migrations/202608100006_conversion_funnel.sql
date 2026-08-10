begin;

alter table public.storefront_cart_sessions
  add column if not exists funnel_stage text not null default 'cart_active',
  add column if not exists first_source jsonb not null default '{}'::jsonb,
  add column if not exists last_source jsonb not null default '{}'::jsonb,
  add column if not exists last_contact_at timestamptz,
  add column if not exists next_contact_at timestamptz,
  add column if not exists contact_count integer not null default 0,
  add column if not exists recovery_owner uuid,
  add column if not exists discard_reason text not null default '';

alter table public.storefront_cart_sessions drop constraint if exists storefront_cart_sessions_status_check;
alter table public.storefront_cart_sessions add constraint storefront_cart_sessions_status_check
  check (status in ('active', 'contacted', 'snoozed', 'recovered', 'dismissed'));

alter table public.orders
  add column if not exists attribution jsonb not null default '{}'::jsonb,
  add column if not exists funnel_session_id uuid;

create table if not exists public.storefront_funnel_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null,
  event_key text not null,
  stage text not null check (stage in (
    'product_viewed', 'added_to_cart', 'checkout_started', 'order_registered',
    'whatsapp_opened', 'partial_payment', 'paid', 'delivered'
  )),
  product_id text references public.products(id) on delete set null,
  order_id text references public.orders(id) on delete set null,
  customer_id text references public.customers(id) on delete set null,
  source jsonb not null default '{}'::jsonb,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, session_id, event_key)
);

create index if not exists storefront_funnel_stage_idx
  on public.storefront_funnel_events (tenant_id, stage, occurred_at desc);
create index if not exists storefront_funnel_order_idx
  on public.storefront_funnel_events (tenant_id, order_id, occurred_at);
create index if not exists storefront_recovery_queue_idx
  on public.storefront_cart_sessions (tenant_id, status, next_contact_at, last_activity_at desc);

alter table public.storefront_funnel_events enable row level security;
drop policy if exists "tenant funnel events read" on public.storefront_funnel_events;
create policy "tenant funnel events read" on public.storefront_funnel_events for select to authenticated
using (public.has_tenant_permission(tenant_id, 'orders') or public.has_tenant_permission(tenant_id, 'reports'));
revoke all on table public.storefront_funnel_events from anon, authenticated;
grant select on table public.storefront_funnel_events to authenticated;

create or replace function public.update_cart_recovery_status(
  p_tenant_id uuid,
  p_cart_id uuid,
  p_status text,
  p_reason text,
  p_delay_hours integer,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart public.storefront_cart_sessions%rowtype;
begin
  if auth.role() <> 'service_role' then raise exception 'Acesso restrito'; end if;
  if p_status not in ('active', 'contacted', 'snoozed', 'dismissed') then raise exception 'Situação inválida'; end if;
  select * into v_cart from public.storefront_cart_sessions
  where tenant_id = p_tenant_id and id = p_cart_id for update;
  if not found then raise exception 'Carrinho não encontrado'; end if;
  if v_cart.status = 'recovered' then raise exception 'Este carrinho já foi convertido'; end if;

  update public.storefront_cart_sessions set
    status = p_status,
    last_contact_at = case when p_status = 'contacted' then now() else last_contact_at end,
    contact_count = case when p_status = 'contacted' then contact_count + 1 else contact_count end,
    recovery_owner = case when p_status = 'contacted' then p_actor_id else recovery_owner end,
    next_contact_at = case when p_status = 'snoozed' then now() + make_interval(hours => greatest(1, least(coalesce(p_delay_hours, 24), 720))) else null end,
    discard_reason = case when p_status = 'dismissed' then left(trim(coalesce(p_reason, '')), 300) else '' end,
    updated_at = now()
  where tenant_id = p_tenant_id and id = p_cart_id;
  return jsonb_build_object('id', p_cart_id, 'status', p_status, 'contact_count', case when p_status = 'contacted' then v_cart.contact_count + 1 else v_cart.contact_count end);
end;
$$;

revoke all on function public.update_cart_recovery_status(uuid, uuid, text, text, integer, uuid) from public, anon, authenticated;
grant execute on function public.update_cart_recovery_status(uuid, uuid, text, text, integer, uuid) to service_role;

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
  if new.status = 'Entregue' and old.status is distinct from 'Entregue' then v_stage := 'delivered'; end if;
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
after update of payment_status, status on public.orders
for each row execute function public.sync_order_funnel_event();

commit;
