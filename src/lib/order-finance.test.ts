import { describe, expect, it } from "vitest";
import type { Order } from "@/types/store";
import { canArchiveOrder, isOrderArchived, orderFinancialAdjustment, orderFinancialTotal } from "./order-finance";

function order(overrides: Partial<Order> = {}) {
  return { total: 500, status: "Entregue", ...overrides } as Order;
}

describe("controle financeiro do pedido", () => {
  it("mantém o total comercial quando não existe ajuste", () => {
    expect(orderFinancialTotal(order())).toBe(500);
    expect(orderFinancialAdjustment(order())).toBe(0);
  });

  it("usa o valor financeiro sem alterar o total comercial", () => {
    const adjusted = order({ financialTotal: 450, financialAdjustment: -50 });
    expect(orderFinancialTotal(adjusted)).toBe(450);
    expect(orderFinancialAdjustment(adjusted)).toBe(-50);
    expect(adjusted.total).toBe(500);
  });

  it("arquiva somente pedidos encerrados e reconhece restauração", () => {
    expect(canArchiveOrder(order({ status: "Entregue", paymentStatus: "Recebido" }))).toBe(true);
    expect(canArchiveOrder(order({ status: "Novo", operationalStatus: "Entregue", paymentStatus: "Pendente" }))).toBe(false);
    expect(canArchiveOrder(order({ status: "Novo", operationalStatus: "Entregue", paymentStatus: "Parcial" }))).toBe(false);
    expect(canArchiveOrder(order({ status: "Cancelado" }))).toBe(true);
    expect(canArchiveOrder(order({ status: "Novo" }))).toBe(false);
    expect(canArchiveOrder(order({ status: "Pago" }))).toBe(false);
    expect(isOrderArchived(order({ archivedAt: "2026-08-05T12:00:00Z" }))).toBe(true);
    expect(isOrderArchived(order({ archivedAt: "" }))).toBe(false);
  });
});
