import { formatMoney } from "@/lib/format";
import type { MessageAutomation, MessageLog, Order } from "@/types/store";

export function renderMessageTemplate(template: string, order: Order) {
  const replacements: Record<string, string> = {
    "{{cliente}}": order.customer.name,
    "{{pedido}}": order.code,
    "{{status}}": order.status,
    "{{total}}": formatMoney(order.total),
  };

  return Object.entries(replacements).reduce(
    (message, [placeholder, value]) => message.replaceAll(placeholder, value),
    template,
  );
}

export function createMessageLogs(order: Order, automations: MessageAutomation[]): MessageLog[] {
  return automations
    .filter((automation) => automation.active && automation.triggerStatus === order.status)
    .map((automation) => ({
      id: crypto.randomUUID(),
      orderId: order.id,
      orderCode: order.code,
      automationId: automation.id,
      automationName: automation.name,
      channel: automation.channel,
      recipient: automation.channel === "whatsapp" ? order.customer.phone : order.customer.email,
      subject: renderMessageTemplate(automation.subject, order),
      message: renderMessageTemplate(automation.message, order),
      status: "simulated" as const,
      createdAt: new Date().toISOString(),
    }));
}
