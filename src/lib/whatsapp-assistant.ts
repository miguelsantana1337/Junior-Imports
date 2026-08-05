import { formatMoney } from "@/lib/format";
import type { CustomerContact, Order, StoreData } from "@/types/store";

export type WhatsappAssistantActionId =
  | "confirm_order"
  | "payment_reminder"
  | "payment_confirmed"
  | "tracking_update"
  | "delivery_check"
  | "post_sale"
  | "cancellation_update";

export type WhatsappAssistantPriority = "urgent" | "high" | "medium" | "low";

export interface WhatsappAssistantSuggestion {
  orderId: string;
  actionId: WhatsappAssistantActionId;
  title: string;
  reason: string;
  priority: WhatsappAssistantPriority;
  createdAt: string;
}

export const whatsappAssistantActions: Record<WhatsappAssistantActionId, { label: string; shortLabel: string }> = {
  confirm_order: { label: "Confirmar recebimento do pedido", shortLabel: "Confirmar pedido" },
  payment_reminder: { label: "Lembrar pagamento com cuidado", shortLabel: "Lembrar pagamento" },
  payment_confirmed: { label: "Confirmar pagamento", shortLabel: "Pagamento confirmado" },
  tracking_update: { label: "Enviar código de rastreamento", shortLabel: "Enviar rastreio" },
  delivery_check: { label: "Confirmar recebimento da entrega", shortLabel: "Confirmar entrega" },
  post_sale: { label: "Fazer acompanhamento pós-venda", shortLabel: "Pós-venda" },
  cancellation_update: { label: "Informar cancelamento", shortLabel: "Avisar cancelamento" },
};

const priorityWeight: Record<WhatsappAssistantPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "cliente";
}

function paymentLabel(order: Order) {
  if (order.payment === "Cartao") return "cartão";
  return order.payment.toLocaleLowerCase("pt-BR");
}

function itemSummary(order: Order) {
  const visible = order.items.slice(0, 4).map((item) => `${item.quantity}x ${item.name}`);
  const remaining = order.items.length - visible.length;
  return `${visible.join(", ")}${remaining > 0 ? ` e mais ${remaining} item${remaining === 1 ? "" : "s"}` : ""}`;
}

export function buildWhatsappAssistantMessage(order: Order, actionId: WhatsappAssistantActionId, storeName: string) {
  const customer = firstName(order.customer.name);
  const introduction = `Olá, ${customer}! Aqui é da ${storeName}.`;

  switch (actionId) {
    case "confirm_order":
      return `${introduction}\n\nRecebemos o seu pedido ${order.code}, no valor de ${formatMoney(order.total)}.\n\nItens: ${itemSummary(order)}.\nForma de pagamento escolhida: ${paymentLabel(order)}.\n\nPosso confirmar os detalhes e seguir com o atendimento por aqui?`;
    case "payment_reminder":
      return `${introduction}\n\nPassando para acompanhar o pedido ${order.code}, que ainda está aguardando a confirmação do pagamento. Se precisar revisar algum dado ou tiver qualquer dúvida, estou à disposição por aqui.`;
    case "payment_confirmed":
      return `${introduction}\n\nO pagamento do pedido ${order.code} foi confirmado. A equipe seguirá com a preparação e avisará por aqui quando houver uma nova atualização.`;
    case "tracking_update":
      return `${introduction}\n\nO pedido ${order.code} já possui código de rastreamento:\n\n${order.trackingCode.trim()}\n\nSe precisar de ajuda para acompanhar a entrega, pode falar comigo por aqui.`;
    case "delivery_check":
      return `${introduction}\n\nO pedido ${order.code} aparece como entregue. Deu tudo certo com o recebimento? Se precisar de qualquer ajuda, estou à disposição.`;
    case "post_sale":
      return `${introduction}\n\nPassando para saber como foi a sua experiência com o pedido ${order.code}. Deu tudo certo com os produtos? Posso ajudar em algo?`;
    case "cancellation_update":
      return `${introduction}\n\nO pedido ${order.code} foi cancelado. Se precisar revisar os itens, fazer um novo pedido ou tirar alguma dúvida, estou à disposição por aqui.`;
  }
}

export function defaultWhatsappAssistantAction(order: Order): WhatsappAssistantActionId {
  if (order.status === "Novo") return "confirm_order";
  if (order.status === "Pago") return order.trackingCode.trim() ? "tracking_update" : "payment_confirmed";
  if (order.status === "Entregue") return "delivery_check";
  return "cancellation_update";
}

export function whatsappAssistantContactMarker(orderCode: string, actionId: WhatsappAssistantActionId) {
  return `[Assistente WhatsApp:${orderCode}:${actionId}]`;
}

export function whatsappAssistantContactSummary(order: Order, actionId: WhatsappAssistantActionId) {
  return `${whatsappAssistantContactMarker(order.code, actionId)} ${whatsappAssistantActions[actionId].label} registrada pelo atendente.`;
}

export function findWhatsappAssistantContact(contacts: CustomerContact[], order: Order, actionId: WhatsappAssistantActionId) {
  const marker = whatsappAssistantContactMarker(order.code, actionId);
  return contacts.find((contact) => contact.customerId === order.customerId && contact.channel === "whatsapp" && contact.summary.includes(marker));
}

export function hasUsableWhatsappPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  return national.length === 10 || national.length === 11;
}

function ageInHours(value: string, now: Date) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0;
  return Math.max(0, (now.getTime() - time) / 3_600_000);
}

function suggestion(
  order: Order,
  actionId: WhatsappAssistantActionId,
  reason: string,
  priority: WhatsappAssistantPriority,
): WhatsappAssistantSuggestion {
  return { orderId: order.id, actionId, title: whatsappAssistantActions[actionId].shortLabel, reason, priority, createdAt: order.createdAt };
}

export function buildWhatsappAssistantSuggestions(
  data: Pick<StoreData, "orders" | "customerContacts">,
  now = new Date(),
) {
  const suggestions: WhatsappAssistantSuggestion[] = [];

  for (const order of data.orders) {
    if (order.archivedAt) continue;
    const orderAge = ageInHours(order.createdAt, now);

    if (order.status === "Novo") {
      const confirmation = findWhatsappAssistantContact(data.customerContacts, order, "confirm_order");
      if (!confirmation) {
        suggestions.push(suggestion(order, "confirm_order", "Pedido novo ainda sem confirmação registrada.", orderAge >= 24 ? "urgent" : "high"));
        continue;
      }

      const reminder = findWhatsappAssistantContact(data.customerContacts, order, "payment_reminder");
      if (!reminder && ageInHours(confirmation.createdAt, now) >= 24) {
        suggestions.push(suggestion(order, "payment_reminder", "A confirmação foi enviada há mais de 24 horas e o pedido continua como Novo.", "urgent"));
      }
      continue;
    }

    if (order.status === "Pago") {
      const paymentConfirmation = findWhatsappAssistantContact(data.customerContacts, order, "payment_confirmed");
      if (!paymentConfirmation) {
        suggestions.push(suggestion(order, "payment_confirmed", "Pagamento confirmado, mas o aviso ao cliente ainda não foi registrado.", "high"));
        continue;
      }

      if (order.trackingCode.trim() && !findWhatsappAssistantContact(data.customerContacts, order, "tracking_update")) {
        suggestions.push(suggestion(order, "tracking_update", "O código de rastreamento já está disponível para envio.", "high"));
      }
      continue;
    }

    if (order.status === "Entregue") {
      const deliveryCheck = findWhatsappAssistantContact(data.customerContacts, order, "delivery_check");
      if (!deliveryCheck) {
        suggestions.push(suggestion(order, "delivery_check", "Pedido entregue sem confirmação de recebimento registrada.", orderAge >= 72 ? "high" : "medium"));
        continue;
      }

      if (!findWhatsappAssistantContact(data.customerContacts, order, "post_sale") && ageInHours(deliveryCheck.createdAt, now) >= 72) {
        suggestions.push(suggestion(order, "post_sale", "A entrega foi confirmada há alguns dias; bom momento para o pós-venda.", "low"));
      }
      continue;
    }

    if (order.status === "Cancelado" && !findWhatsappAssistantContact(data.customerContacts, order, "cancellation_update")) {
      suggestions.push(suggestion(order, "cancellation_update", "Cancelamento ainda sem comunicação registrada.", "low"));
    }
  }

  return suggestions.sort((a, b) => priorityWeight[a.priority] - priorityWeight[b.priority]
    || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}
