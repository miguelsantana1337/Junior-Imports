import { formatMoney, whatsappUrl } from "@/lib/format";
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

function formatDiscountPercentage(discount: number, subtotal: number) {
  if (discount <= 0 || subtotal <= 0) return "0%";

  const percentage = Math.min(100, (discount / subtotal) * 100);
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(percentage)}%`;
}

function addDiscountSummary(message: string, summary: string) {
  const lines = message.split("\n");
  const totalLine = lines.findIndex((line) => /\btotal(?: do pedido)?\s*:/i.test(line.replaceAll("*", "")));

  if (totalLine >= 0) {
    lines.splice(totalLine + 1, 0, summary);
    return lines.join("\n");
  }

  return `${message}\n\n${summary}`;
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

  const template = resolveMessageTemplate(settings.whatsappMessage);
  const discountPercentage = formatDiscountPercentage(order.discount, order.subtotal);

  const values: Record<string, string> = {
    "{{loja}}": settings.storeName,
    "{{pedido}}": order.code,
    "{{cliente}}": order.customer.name,
    "{{itens}}": items,
    "{{total}}": formatMoney(order.total),
    "{{pagamento}}": paymentLabel(order.payment),
    "{{cupom}}": order.couponCode || "Nenhum",
    "{{desconto}}": formatMoney(order.discount),
    "{{percentual_desconto}}": discountPercentage,
  };

  let rendered = Object.entries(values).reduce(
    (message, [placeholder, value]) => message.replaceAll(placeholder, value),
    template,
  );

  const templateControlsDiscount = template.includes("{{desconto}}") || template.includes("{{percentual_desconto}}");
  if (order.discount > 0 && order.subtotal > 0 && !templateControlsDiscount) {
    rendered = addDiscountSummary(
      rendered,
      `🏷️ *Desconto obtido:* ${formatMoney(order.discount)} (${discountPercentage})`,
    );
  }

  const cashbackNotice = order.cashbackTotal > 0
    ? `\n\n🟢 *Cashback previsto:* ${formatMoney(order.cashbackTotal)} (após a confirmação do pedido)`
    : "";

  return `${rendered}${cashbackNotice}\n\n✅ *${checkoutTermsConfirmation}*`;
}

export function checkoutWhatsappUrl(order: Order, settings: StoreSettings) {
  return whatsappUrl(settings.whatsapp, renderWhatsappOrderMessage(order, settings));
}
