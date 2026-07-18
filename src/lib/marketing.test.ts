import { describe, expect, it } from "vitest";
import { automationMatchesOrder, calendarItemsForDay, canTransitionPublication, marketingCalendarItems, renderAutomationTemplate } from "./marketing";
import type { MarketingPublication, MessageAutomation, Order } from "@/types/store";

const order: Order = {
  id: "order-1", customerId: "customer-1", code: "JI-1001", createdAt: "2026-07-18T12:00:00.000Z",
  customer: { name: "Maria", email: "maria@example.com", phone: "31999999999", address: "", number: "", complement: "", city: "", state: "", zip: "" },
  items: [], subtotal: 200, discount: 0, shipping: 0, total: 200, cashbackTotal: 20, payment: "Pix", status: "Pago", couponCode: "", internalNotes: "", trackingCode: "", orderSource: "admin", reservationExpiresAt: "",
};

const automation: MessageAutomation = {
  id: "automation-1", name: "Pagamento", triggerType: "order_status", triggerValue: "Pago", triggerStatus: "Pago", channel: "whatsapp", subject: "", message: "Olá, {{cliente}}. Pedido {{pedido}}: {{status}} — {{total}}.",
  conditions: { minOrderTotal: 100, orderSource: "admin", customerSegment: "vip" }, actions: { sendMessage: true, createTask: false, taskTitle: "", addTag: "" }, status: "active", maxRetries: 3, retryDelayMinutes: 15, lastTestedAt: "", runCount: 0, failureCount: 0, active: true, order: 1,
};

const publication: MarketingPublication = {
  id: "publication-1", name: "Campanha de julho", description: "", kind: "campaign", entityId: "", status: "scheduled", startsAt: "2026-07-18T09:00:00.000Z", endsAt: "2026-07-20T23:00:00.000Z", ownerEmail: "owner@example.com", reviewerEmail: "reviewer@example.com", revision: 2, notes: "", lastPublishedAt: "", createdAt: "", updatedAt: "",
};

describe("workflow de marketing", () => {
  it("restringe transições do fluxo editorial", () => {
    expect(canTransitionPublication("draft", "in_review")).toBe(true);
    expect(canTransitionPublication("draft", "published")).toBe(false);
    expect(canTransitionPublication("approved", "scheduled")).toBe(true);
  });

  it("inclui publicações agendadas no calendário do período", () => {
    const items = marketingCalendarItems([publication], [], []);
    expect(calendarItemsForDay(items, new Date(2026, 6, 19))).toHaveLength(1);
    expect(calendarItemsForDay(items, new Date(2026, 6, 21))).toHaveLength(0);
  });
});

describe("motor de automações", () => {
  it("avalia gatilho e condições do pedido", () => {
    expect(automationMatchesOrder(automation, order, "vip")).toBe(true);
    expect(automationMatchesOrder(automation, { ...order, total: 50 }, "vip")).toBe(false);
    expect(automationMatchesOrder(automation, order, "new")).toBe(false);
  });

  it("renderiza os campos do pedido sem deixar placeholders", () => {
    const rendered = renderAutomationTemplate(automation.message, order);
    expect(rendered).toContain("Maria");
    expect(rendered).toContain("JI-1001");
    expect(rendered).not.toContain("{{");
  });
});
