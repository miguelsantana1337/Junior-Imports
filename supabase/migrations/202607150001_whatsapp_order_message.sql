-- Formata a mensagem do checkout com quebras reais e inclui pagamento e cupom.
-- O filtro limita a alteração à loja Junior Imports e preserva eventuais modelos
-- personalizados de outros tenants.
update public.store_settings
set whatsapp_message = $message$🛒 *Novo pedido – {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

📦 *Pedido:* {{pedido}}

*Produtos:*
{{itens}}

💰 *Total do pedido:* {{total}}
💳 *Forma de pagamento:* {{pagamento}}
🎟️ *Cupom utilizado:* {{cupom}}

👤 *Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!$message$
where tenant_id = '00000000-0000-4000-8000-000000000100';

alter table public.store_settings
  alter column whatsapp_message set default $message$🛒 *Novo pedido – {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

📦 *Pedido:* {{pedido}}

*Produtos:*
{{itens}}

💰 *Total do pedido:* {{total}}
💳 *Forma de pagamento:* {{pagamento}}
🎟️ *Cupom utilizado:* {{cupom}}

👤 *Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!$message$;
