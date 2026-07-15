import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { buildCustomerInsights, customerRecurrenceRate, normalizeCustomerEmail, normalizeCustomerPhone } from "./crm";

describe("CRM de clientes", () => {
  it("normaliza e-mail e telefone para identificar o mesmo cliente", () => {
    expect(normalizeCustomerEmail(" Cliente@Exemplo.COM ")).toBe("cliente@exemplo.com");
    expect(normalizeCustomerPhone("(31) 99999-9999")).toBe("5531999999999");
  });

  it("calcula frequência, ticket e produtos favoritos a partir dos pedidos", () => {
    const repeated = { ...seedData.orders[0], id: "repeat", createdAt: "2026-07-13T12:00:00-03:00" };
    const insights = buildCustomerInsights([], [seedData.orders[0], repeated], new Date("2026-07-15T12:00:00-03:00"));
    expect(insights).toHaveLength(1);
    expect(insights[0].orderCount).toBe(2);
    expect(insights[0].averageTicket).toBeCloseTo(seedData.orders[0].total);
    expect(insights[0].favoriteProducts[0]).toBe(seedData.orders[0].items[0].name);
    expect(customerRecurrenceRate(insights)).toBe(100);
  });
});
