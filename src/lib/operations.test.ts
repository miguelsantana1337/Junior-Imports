import { describe, expect, it } from "vitest";
import type { CustomerTask, FinancialTransaction, Product } from "@/types/store";
import { financialSummary, inventoryAlerts, movementStockDelta, productProfit, tasksDueToday } from "./operations";

describe("operações integradas", () => {
  it("calcula lucro e margem do produto", () => {
    expect(productProfit({ price: 100, costPrice: 60 })).toEqual({ grossProfit: 40, marginPercent: 40 });
  });

  it("consolida realizado, pendências e projeção", () => {
    const base = { category: "", account: "", costCenter: "", orderId: "", purchaseOrderId: "", recurring: false, notes: "", paidAt: "", createdAt: "2026-07-01" };
    const transactions: FinancialTransaction[] = [
      { ...base, id: "1", type: "income", status: "paid", description: "Venda", amount: 1000, dueDate: "2026-07-01" },
      { ...base, id: "2", type: "expense", status: "paid", description: "Custo", amount: 600, dueDate: "2026-07-01" },
      { ...base, id: "3", type: "expense", status: "pending", description: "Conta", amount: 100, dueDate: "2026-07-05" },
    ];
    expect(financialSummary(transactions, new Date("2026-07-10T12:00:00"))).toMatchObject({ income: 1000, expenses: 600, netProfit: 400, payable: 100, overdue: 100, projectedBalance: 300 });
  });

  it("identifica reposição e direção do movimento", () => {
    const products = [{ id: "p1", active: true, stock: 4, minStock: 5 }, { id: "p2", active: true, stock: 9, minStock: 5 }] as Product[];
    expect(inventoryAlerts(products).map((item) => item.id)).toEqual(["p1"]);
    expect(movementStockDelta("sale", 3)).toBe(-3);
    expect(movementStockDelta("purchase", 3)).toBe(3);
  });

  it("organiza tarefas vencidas e do dia", () => {
    const base = { customerId: "c", priority: "medium", status: "open", assignedTo: "", notes: "", createdAt: "", completedAt: "" } as const;
    const tasks: CustomerTask[] = [
      { ...base, id: "later", title: "Depois", dueAt: "2026-07-16T09:00:00" },
      { ...base, id: "today", title: "Hoje", dueAt: "2026-07-15T09:00:00" },
    ];
    expect(tasksDueToday(tasks, new Date("2026-07-15T12:00:00")).map((item) => item.id)).toEqual(["today"]);
  });
});
