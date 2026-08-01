begin;

-- O painel passa a trabalhar com um fluxo operacional curto:
-- Novo -> Pago -> Entregue, com Cancelado como saída.
-- A migração preserva a intenção dos estados antigos sem alterar estoque,
-- cashback, automações ou o histórico de auditoria.
alter table public.orders disable trigger user;

update public.orders
set status = case status
  when 'Aguardando pagamento' then 'Novo'
  when 'Preparando' then 'Pago'
  when 'Enviado' then 'Entregue'
  else status
end
where status in ('Aguardando pagamento', 'Preparando', 'Enviado');

alter table public.orders enable trigger user;

update public.message_automations
set
  trigger_status = case trigger_status
    when 'Aguardando pagamento' then 'Novo'
    when 'Preparando' then 'Pago'
    when 'Enviado' then 'Entregue'
    else trigger_status
  end,
  trigger_value = case
    when trigger_type <> 'order_status' then trigger_value
    when trigger_value = 'Aguardando pagamento' then 'Novo'
    when trigger_value = 'Preparando' then 'Pago'
    when trigger_value = 'Enviado' then 'Entregue'
    else trigger_value
  end,
  name = case when id = 'automation-shipped' then 'Pedido entregue' else name end,
  message = case
    when id = 'automation-shipped'
      then 'Olá, {{cliente}}! O pedido {{pedido}} foi atualizado para Entregue.'
    else message
  end,
  updated_at = now()
where trigger_status in ('Aguardando pagamento', 'Preparando', 'Enviado')
   or (trigger_type = 'order_status' and trigger_value in ('Aguardando pagamento', 'Preparando', 'Enviado'))
   or id = 'automation-shipped';

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('Novo', 'Pago', 'Entregue', 'Cancelado'));

alter table public.message_automations
  drop constraint if exists message_automations_trigger_status_check;

alter table public.message_automations
  add constraint message_automations_trigger_status_check
  check (trigger_status in ('Novo', 'Pago', 'Entregue', 'Cancelado'));

-- Atualiza a função operacional sem duplicar a extensa lógica transacional
-- de estoque, financeiro e reservas já consolidada em produção.
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
    'p_status in (''Pago'', ''Preparando'', ''Enviado'', ''Entregue'')',
    'p_status in (''Pago'', ''Entregue'')'
  );
  updated_definition := replace(
    updated_definition,
    'p_status not in (''Novo'', ''Aguardando pagamento'', ''Pago'', ''Preparando'', ''Enviado'', ''Entregue'', ''Cancelado'')',
    'p_status not in (''Novo'', ''Pago'', ''Entregue'', ''Cancelado'')'
  );
  updated_definition := replace(
    updated_definition,
    'v_order.status not in (''Pago'', ''Preparando'', ''Enviado'', ''Entregue'')',
    'v_order.status not in (''Pago'', ''Entregue'')'
  );

  if updated_definition = current_definition
    or position('Aguardando pagamento' in updated_definition) > 0
    or position('Preparando' in updated_definition) > 0
    or position('Enviado' in updated_definition) > 0
  then
    raise exception 'Não foi possível simplificar update_tenant_order_status';
  end if;

  execute updated_definition;
end;
$$;

-- Cashback deve continuar sendo creditado somente quando a venda é confirmada.
do $$
declare
  current_definition text;
  updated_definition text;
begin
  select pg_get_functiondef(
    'public.sync_order_cashback_wallet()'::regprocedure
  ) into current_definition;

  updated_definition := replace(
    current_definition,
    'new.status in (''Pago'', ''Preparando'', ''Enviado'', ''Entregue'')',
    'new.status in (''Pago'', ''Entregue'')'
  );

  if updated_definition = current_definition
    or position('Preparando' in updated_definition) > 0
    or position('Enviado' in updated_definition) > 0
  then
    raise exception 'Não foi possível simplificar sync_order_cashback_wallet';
  end if;

  execute updated_definition;
end;
$$;

-- Modelo compatível com Android: texto simples, sem pictogramas e sem SKU.
update public.store_settings
set whatsapp_message = $message$*Novo pedido - {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

*Pedido:* {{pedido}}

*Produtos:*
{{itens}}

*{{rotulo_total}}:* {{total}}
*Frete:* {{frete}}
*Forma de pagamento:* {{pagamento}}
*Cupom utilizado:* {{cupom}}

*Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!$message$,
    updated_at = now()
where tenant_id = '00000000-0000-4000-8000-000000000100';

alter table public.store_settings
  alter column whatsapp_message set default $message$*Novo pedido - {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

*Pedido:* {{pedido}}

*Produtos:*
{{itens}}

*{{rotulo_total}}:* {{total}}
*Frete:* {{frete}}
*Forma de pagamento:* {{pagamento}}
*Cupom utilizado:* {{cupom}}

*Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!$message$;

commit;
