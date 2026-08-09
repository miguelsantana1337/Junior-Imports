import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import type { FinancialTransaction, Order } from "@/types/store";
import { orderPaymentHistory, orderPaymentSummary, orderPaymentsRevenue } from "./order-payments";

const order: Order = {
  ...seedData.orders[0],
  id: "order-parts",
  total: 1_000,
  financialTotal: 1_000,
  status: "Novo",
  paymentStatus: "Parcial",
  amountPaid: 400,
};

const payments: FinancialTransaction[] = [
  { id: "order-payment-order-parts-1", type: "income", status: "paid", description: "Parcela 1", amount: 250, category: "Vendas", account: "Conta principal", costCenter: "Comercial", dueDate: "2026-08-08", paidAt: "2026-08-08T12:00:00-03:00", orderId: order.id, purchaseOrderId: "", recurring: false, notes: "", externalKey: "order-payment:order-parts:1", createdAt: "2026-08-08T12:00:00-03:00" },
  { id: "order-payment-order-parts-2", type: "income", status: "paid", description: "Parcela 2", amount: 150, category: "Vendas", account: "Conta principal", costCenter: "Comercial", dueDate: "2026-08-09", paidAt: "2026-08-09T12:00:00-03:00", orderId: order.id, purchaseOrderId: "", recurring: false, notes: "", externalKey: "order-payment:order-parts:2", createdAt: "2026-08-09T12:00:00-03:00" },
  { id: "order-income-order-parts", type: "income", status: "cancelled", description: "Venda", amount: 1_000, category: "Vendas", account: "Conta principal", costCenter: "Comercial", dueDate: "", paidAt: "", orderId: order.id, purchaseOrderId: "", recurring: false, notes: "", externalKey: "order-income:order-parts", createdAt: "2026-08-09T12:01:00-03:00" },
];

describe("pagamentos em partes", () => {
  it("calcula o valor recebido e o saldo restante", () => {
    expect(orderPaymentSummary(order, payments)).toMatchObject({ total: 1_000, paid: 400, remaining: 600 });
  });

  it("não exibe o lançamento agregado quando existem parcelas", () => {
    expect(orderPaymentHistory(order.id, payments).map((payment) => payment.id)).toEqual([
      "order-payment-order-parts-2",
      "order-payment-order-parts-1",
    ]);
  });

  it("zera o recebido efetivo depois de estorno, preservando o histórico", () => {
    const summary = orderPaymentSummary({ ...order, paymentStatus: "Estornado" }, payments);
    expect(summary.paid).toBe(0);
    expect(summary.historicalPaid).toBe(400);
  });

  it("soma parcelas pagas na receita do período", () => {
    expect(orderPaymentsRevenue(payments, new Date("2026-08-09T00:00:00-03:00"))).toBe(150);
  });

  it("mantém compatibilidade com pedidos quitados antes do novo campo", () => {
    const legacy = { ...order, paymentStatus: "Recebido" as const, status: "Pago" as const, amountPaid: 0 };
    expect(orderPaymentSummary(legacy, [])).toMatchObject({ paid: 1_000, remaining: 0 });
  });
});
