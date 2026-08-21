import { describe, expect, it } from "vitest";
import {
  resolveMcpOperationPeriod,
  summarizeMcpCash,
  summarizeMcpInventory,
  summarizeMcpOrders,
} from "@/lib/mcp/operation-metrics";

describe("métricas operacionais do MCP", () => {
  it("usa o mês atual por padrão e respeita o início oficial da operação", () => {
    const period = resolveMcpOperationPeriod({
      now: new Date("2026-08-21T12:00:00-03:00"),
      operationStartedAt: "2026-08-03T03:00:00.000Z",
    });

    expect(period).toMatchObject({
      requestedDateFrom: "2026-08-01",
      requestedDateTo: "2026-08-21",
      dateFrom: "2026-08-03",
      dateTo: "2026-08-21",
      limitedByOperationStart: true,
      hasStarted: true,
    });
  });

  it("rejeita um período invertido", () => {
    expect(() => resolveMcpOperationPeriod({
      dateFrom: "2026-08-21",
      dateTo: "2026-08-01",
    })).toThrow("A data inicial não pode ser posterior à data final.");
  });

  it("separa pedidos recebidos, saldo em aberto e margem incompleta", () => {
    const summary = summarizeMcpOrders([
      {
        id: "1", code: "JI-1", financial_total: 100, amount_paid: 100,
        operational_status: "Em preparação", payment_status: "Recebido",
        order_items: [{ quantity: 2, unit_cost: 20 }],
      },
      {
        id: "2", code: "JI-2", financial_total: 200, amount_paid: 50,
        operational_status: "Confirmado", payment_status: "Parcial",
        order_items: [{ quantity: 1, unit_cost: 0 }],
      },
      {
        id: "3", code: "JI-3", financial_total: 300, amount_paid: 0,
        operational_status: "Cancelado", payment_status: "Cancelado",
        order_items: [{ quantity: 3, unit_cost: 10 }],
      },
    ]);

    expect(summary).toMatchObject({
      totalOrders: 3,
      activeOrders: 2,
      cancelledOrders: 1,
      receivedOrders: 1,
      openPaymentOrders: 1,
      openAmount: 150,
      unitsOrdered: 3,
      revenue: 100,
      grossCost: 40,
      grossProfit: 60,
      grossMarginPercent: 60,
      grossMarginIsComplete: true,
    });
  });

  it("resume estoque ativo e filtra os itens que precisam de reposição", () => {
    const summary = summarizeMcpInventory([
      { id: "1", name: "A", active: true, stock: 0, min_stock: 5, cost_price: 10, price: 20 },
      { id: "2", name: "B", active: true, stock: 8, min_stock: 3, cost_price: 5, price: 15 },
      { id: "3", name: "C", active: true, stock: 20, min_stock: 5, cost_price: 2, price: 6 },
      { id: "4", name: "D", active: false, stock: 50, min_stock: 5, cost_price: 1, price: 3 },
    ], { status: "low_stock", limit: 10 });

    expect(summary).toMatchObject({
      totalProducts: 3,
      totalUnits: 28,
      lowStockProducts: 2,
      outOfStockProducts: 1,
      stockValueAtCost: 80,
      stockValueAtRetail: 240,
    });
    expect(summary.products.map((product) => product.name)).toEqual(["A", "B"]);
  });

  it("distingue pagamentos de pedidos das demais entradas do caixa", () => {
    const summary = summarizeMcpCash([
      { type: "income", amount: 100, order_id: "order-1" },
      { type: "income", amount: 30, order_id: null },
      { type: "expense", amount: 40 },
    ]);

    expect(summary).toEqual({
      income: 130,
      orderPayments: 100,
      otherIncome: 30,
      expenses: 40,
      result: 90,
      transactionCount: 3,
    });
  });
});
