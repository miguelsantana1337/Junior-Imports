import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { confirmedOrderRevenue, isRevenueOrder } from "./order-revenue";

describe("receita confirmada de pedidos", () => {
  it.each(["Pago", "Preparando", "Enviado", "Entregue"] as const)(
    "inclui pedidos com status %s",
    (status) => expect(isRevenueOrder({ status })).toBe(true),
  );

  it.each(["Novo", "Aguardando pagamento", "Cancelado"] as const)(
    "exclui pedidos com status %s",
    (status) => expect(isRevenueOrder({ status })).toBe(false),
  );

  it("soma somente pedidos confirmados dentro do período", () => {
    const baseOrder = seedData.orders[0];
    const orders = [
      { ...baseOrder, id: "paid", status: "Pago" as const, total: 500, createdAt: "2026-07-18T12:00:00-03:00" },
      { ...baseOrder, id: "cancelled", status: "Cancelado" as const, total: 900, createdAt: "2026-07-18T12:00:00-03:00" },
      { ...baseOrder, id: "waiting", status: "Aguardando pagamento" as const, total: 700, createdAt: "2026-07-18T12:00:00-03:00" },
      { ...baseOrder, id: "old", status: "Entregue" as const, total: 300, createdAt: "2026-07-01T12:00:00-03:00" },
    ];

    expect(confirmedOrderRevenue(orders, new Date("2026-07-13T00:00:00-03:00"))).toBe(500);
  });
});
