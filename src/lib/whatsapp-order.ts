import { formatMoney, whatsappUrl } from "@/lib/format";
import type { Order, StoreSettings } from "@/types/store";
import { orderTotalLabel, shippingPriceLabel } from "@/lib/shipping";

export const defaultWhatsappOrderMessage = `*Novo pedido - {{loja}}*

Olá! Gostaria de finalizar o seguinte pedido:

*Pedido:* {{pedido}}

*Produtos:*
{{itens}}

*{{rotulo_total}}:* {{total}}
*Frete:* {{frete}}
*Forma de pagamento:* {{pagamento}}
*Cupom utilizado:* {{cupom}}

*Cliente:* {{cliente}}

Aguardo a confirmação. Obrigado!`;

function normalizeForWhatsapp(message: string) {
  return message
    .replace(/\{\{sku\}\}/gi, "")
    .replace(/^[ \t]*(?:[-•][ \t]*)?SKU[ \t]*:.*$/gim, "")
    .replace(/^[ \t*_~-]*(?:(?:o[ \t]+)?cliente[ \t]+)?(?:concordou|consentiu|autorizou)[^\n]*(?:tratamento|uso)[^\n]*dados(?: pessoais)?[^\n]*$/gim, "")
    .replace(/\p{Extended_Pictographic}|\p{Regional_Indicator}/gu, "")
    .replace(/[\u200d\ufe0e\ufe0f\u20e3]/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/^[ \t]+/gm, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

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

function shippingMessage(order: Order) {
  if (order.shippingStatus === "pickup" || order.customer.deliveryMethod === "pickup") {
    return "Retirada no local";
  }
  if (order.shippingStatus === "quote") {
    const destination = [order.customer.city, order.customer.state].filter(Boolean).join("/");
    const location = [order.customer.zip, destination].filter(Boolean).join(" · ");
    return `A cotar pelo CEP${location ? ` (${location})` : ""}`;
  }
  return shippingPriceLabel(order.shippingStatus, order.shipping);
}

function resolveMessageTemplate(message: string) {
  const normalized = message.replace(/\\n/g, "\n").trim();
  const isLegacyDefault = normalized.startsWith("Olá! Quero finalizar o pedido {{pedido}} da {{loja}}.");
  return !normalized || isLegacyDefault ? defaultWhatsappOrderMessage : normalized;
}

export function renderWhatsappOrderMessage(order: Order, settings: StoreSettings) {
  const items = order.items
    .map((item) => {
      const composition = item.components?.length
        ? `\n  Composição: ${item.components.map((component) => `${component.quantity}x ${component.name}`).join("; ")}`
        : "";
      return `- ${item.quantity}x ${item.name} - ${formatMoney(item.quantity * item.unitPrice)}${composition}`;
    })
    .join("\n");

  const template = resolveMessageTemplate(settings.whatsappMessage);
  const discountPercentage = formatDiscountPercentage(order.discount, order.subtotal);
  const freight = shippingMessage(order);
  const totalLabel = orderTotalLabel(order.shippingStatus);

  const values: Record<string, string> = {
    "{{loja}}": settings.storeName,
    "{{pedido}}": order.code,
    "{{cliente}}": order.customer.name,
    "{{itens}}": items,
    "{{total}}": formatMoney(order.total),
    "{{rotulo_total}}": totalLabel,
    "{{frete}}": freight,
    "{{pagamento}}": paymentLabel(order.payment),
    "{{cupom}}": order.couponCode || "Nenhum",
    "{{desconto}}": formatMoney(order.discount),
    "{{percentual_desconto}}": discountPercentage,
  };

  let rendered = Object.entries(values).reduce(
    (message, [placeholder, value]) => message.replaceAll(placeholder, value),
    template,
  );

  if (order.shippingStatus === "quote" && !template.includes("{{rotulo_total}}")) {
    rendered = rendered.replace(/Total do pedido/i, totalLabel);
  }
  if (!template.includes("{{frete}}")) {
    rendered = addDiscountSummary(rendered, `*Frete:* ${freight}`);
  }

  const templateControlsDiscount = template.includes("{{desconto}}") || template.includes("{{percentual_desconto}}");
  if (order.discount > 0 && order.subtotal > 0 && !templateControlsDiscount) {
    rendered = addDiscountSummary(
      rendered,
      `*Desconto obtido:* ${formatMoney(order.discount)} (${discountPercentage})`,
    );
  }

  const cashbackNotice = order.cashbackTotal > 0
    ? `\n\n*Cashback previsto:* ${formatMoney(order.cashbackTotal)} (após a confirmação do pedido)`
    : "";
  const loyaltyNotice = (order.loyaltyDiscount ?? 0) > 0
    ? `\n\n*Benefício de fidelidade:* -${formatMoney(order.loyaltyDiscount ?? 0)}`
    : "";
  const giftNotice = order.campaignGift
    ? `\n\n*Brinde da campanha:* ${order.campaignGift}`
    : "";
  const pickupNotice = order.shippingStatus === "pickup" || order.customer.deliveryMethod === "pickup"
    ? `\n\n*Retirada no local:* ${settings.localPickupInstructions}`
    : "";

  return normalizeForWhatsapp(`${rendered}${loyaltyNotice}${cashbackNotice}${giftNotice}${pickupNotice}`);
}

export function checkoutWhatsappUrl(order: Order, settings: StoreSettings) {
  return whatsappUrl(settings.whatsapp, renderWhatsappOrderMessage(order, settings));
}
