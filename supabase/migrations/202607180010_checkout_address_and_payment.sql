-- Adiciona dinheiro como forma de pagamento, preservando boleto apenas para o histórico.

alter table public.orders drop constraint if exists orders_payment_check;
alter table public.orders add constraint orders_payment_check
  check (payment in ('Pix', 'Cartao', 'Dinheiro', 'Boleto'));

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
    'p_payment not in (''Pix'', ''Cartao'', ''Boleto'')',
    'p_payment not in (''Pix'', ''Cartao'', ''Dinheiro'', ''Boleto'')'
  );

  if updated_definition = current_definition then
    raise exception 'Não foi possível atualizar os métodos aceitos em create_tenant_order_secure';
  end if;

  execute updated_definition;
end;
$$;
