import { formatMoney } from "@/lib/format";
import type { Order, StoreSettings } from "@/types/store";
import { checkoutTermsConfirmation } from "@/lib/checkout-terms";

export const defaultWhatsappOrderMessage = `🛒 *Novo pedido – {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

📦 *Pedido:* {{pedido}}

*Produtos:*
{{itens}}

💰 *Total do pedido:* {{total}}
💳 *Forma de pagamento:* {{pagamento}}
🎟️ *Cupom utilizado:* {{cupom}}

👤 *Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!`;

function paymentLabel(payment: Order["payment"]) {
  return payment === "Cartao" ? "Cartão" : payment;
}

function resolveMessageTemplate(message: string) {
  const normalized = message.replace(/\\n/g, "\n").trim();
  const isLegacyDefault = normalized.startsWith("Olá! Quero finalizar o pedido {{pedido}} da {{loja}}.");
  return !normalized || isLegacyDefault ? defaultWhatsappOrderMessage : normalized;
}

export function renderWhatsappOrderMessage(order: Order, settings: StoreSettings) {
  const items = order.items
    .map((item) => `• ${item.quantity}x ${item.name} — ${formatMoney(item.quantity * item.unitPrice)}`)
    .join("\n");

  const values: Record<string, string> = {
    "{{loja}}": settings.storeName,
    "{{pedido}}": order.code,
    "{{cliente}}": order.customer.name,
    "{{itens}}": items,
    "{{total}}": formatMoney(order.total),
    "{{pagamento}}": paymentLabel(order.payment),
    "{{cupom}}": order.couponCode || "Nenhum",
  };

  const rendered = Object.entries(values).reduce(
    (message, [placeholder, value]) => message.replaceAll(placeholder, value),
    resolveMessageTemplate(settings.whatsappMessage),
  );
  const cashbackNotice = order.cashbackTotal > 0
    ? `\n\n🟢 *Cashback previsto:* ${formatMoney(order.cashbackTotal)} (após a confirmação do pedido)`
    : "";

  return `${rendered}${cashbackNotice}\n\n✅ *${checkoutTermsConfirmation}*`;
}
