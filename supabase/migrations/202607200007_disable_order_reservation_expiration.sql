-- Pedidos da loja passam a reservar estoque até confirmação ou cancelamento
-- manual. O parâmetro antigo de minutos é mantido apenas por compatibilidade
-- com as rotas já publicadas.

create or replace function public.expire_storefront_reservations(p_tenant_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
begin
  return 0;
end;
$$;

do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.create_tenant_order_secure(uuid,jsonb,jsonb,text,text,uuid,text,text,text,integer)'::regprocedure
  ) into current_definition;

  updated_definition := replace(
    current_definition,
    'v_expires_at := now() + make_interval(mins => greatest(5, least(coalesce(p_reservation_minutes, 30), 1440)));',
    'v_expires_at := ''9999-12-31 23:59:59+00''::timestamptz;'
  );

  if updated_definition = current_definition
    or position('9999-12-31 23:59:59+00' in updated_definition) = 0
  then
    raise exception 'Não foi possível remover a expiração automática de create_tenant_order_secure';
  end if;

  execute updated_definition;
end;
$$;

update public.order_stock_reservations
set expires_at = '9999-12-31 23:59:59+00'::timestamptz,
    updated_at = now()
where status = 'active';

update public.orders
set reservation_expires_at = '9999-12-31 23:59:59+00'::timestamptz
where status in ('Novo', 'Aguardando pagamento')
  and reservation_expires_at is not null;
