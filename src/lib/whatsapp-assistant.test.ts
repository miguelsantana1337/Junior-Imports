import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import {
  buildWhatsappAssistantMessage,
  buildWhatsappAssistantSuggestions,
  hasUsableWhatsappPhone,
  whatsappAssistantContactSummary,
} from "./whatsapp-assistant";

describe("Assistente WhatsApp", () => {
  it("prepara uma mensagem transacional sem expor SKU", () => {
    const data = cloneSeedData();
    const order = data.orders[0];
    const message = buildWhatsappAssistantMessage(order, "confirm_order", data.settings.storeName);

    expect(message).toContain(order.code);
    expect(message).toContain(order.customer.name.split(" ")[0]);
    expect(message).toContain(order.items[0].name);
    expect(message).not.toContain(data.products.find((product) => product.id === order.items[0].productId)?.sku);
  });

  it("prioriza pedidos novos sem contato e pagamentos ainda não avisados", () => {
    const data = cloneSeedData();
    const suggestions = buildWhatsappAssistantSuggestions(data, new Date("2026-08-01T12:00:00-03:00"));

    expect(suggestions.some((item) => item.orderId === "order-1003" && item.actionId === "confirm_order" && item.priority === "urgent")).toBe(true);
    expect(suggestions.some((item) => item.orderId === "order-1001" && item.actionId === "payment_confirmed")).toBe(true);
  });

  it("troca a confirmação por lembrete após 24 horas", () => {
    const data = cloneSeedData();
    const order = data.orders.find((item) => item.status === "Novo")!;
    data.customerContacts.push({
      id: "contact-assistant",
      customerId: order.customerId,
      channel: "whatsapp",
      result: "follow_up",
      summary: whatsappAssistantContactSummary(order, "confirm_order"),
      nextStepAt: "",
      actorEmail: "admin@example.com",
      createdAt: "2026-07-30T10:00:00-03:00",
    });

    const suggestions = buildWhatsappAssistantSuggestions(data, new Date("2026-08-01T12:00:00-03:00"));
    expect(suggestions.some((item) => item.orderId === order.id && item.actionId === "payment_reminder")).toBe(true);
    expect(suggestions.some((item) => item.orderId === order.id && item.actionId === "confirm_order")).toBe(false);
  });

  it("reconhece telefones brasileiros com ou sem DDI", () => {
    expect(hasUsableWhatsappPhone("(31) 99999-0000")).toBe(true);
    expect(hasUsableWhatsappPhone("+55 31 99999-0000")).toBe(true);
    expect(hasUsableWhatsappPhone("1234")).toBe(false);
  });

  it("não cria pendências operacionais para pedidos arquivados", () => {
    const data = cloneSeedData();
    const archived = data.orders.find((order) => order.status === "Novo")!;
    archived.archivedAt = "2026-08-01T11:00:00-03:00";

    const suggestions = buildWhatsappAssistantSuggestions(data, new Date("2026-08-01T12:00:00-03:00"));
    expect(suggestions.some((item) => item.orderId === archived.id)).toBe(false);
  });
});
