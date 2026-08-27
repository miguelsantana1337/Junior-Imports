import { describe, expect, it } from "vitest";
import {
  legacyStatusForLifecycle,
  lifecycleChangeConsequences,
  lifecycleReasonRequired,
  nextOrderAction,
  orderOperationalStatus,
  orderPaymentStatus,
} from "./order-lifecycle";

describe("ciclo operacional do pedido", () => {
  it("traduz os quatro status antigos sem perder a operação existente", () => {
    expect(orderOperationalStatus({ status: "Novo" })).toBe("Novo");
    expect(orderOperationalStatus({ status: "Pago" })).toBe("Em preparação");
    expect(orderPaymentStatus({ status: "Pago" })).toBe("Recebido");
    expect(orderPaymentStatus({ status: "Cancelado" })).toBe("Cancelado");
  });

  it("mantém o status legado sincronizado para estoque, caixa e cashback", () => {
    expect(legacyStatusForLifecycle("Confirmado", "Pendente")).toBe("Novo");
    expect(legacyStatusForLifecycle("Em preparação", "Recebido")).toBe("Pago");
    expect(legacyStatusForLifecycle("Entregue", "Recebido")).toBe("Entregue");
    expect(legacyStatusForLifecycle("Entregue", "Pendente")).toBe("Novo");
    expect(legacyStatusForLifecycle("Entregue", "Parcial")).toBe("Novo");
    expect(legacyStatusForLifecycle("Cancelado", "Estornado")).toBe("Cancelado");
  });

  it("indica uma única próxima ação por vez", () => {
    expect(nextOrderAction({ status: "Novo" })?.label).toBe("Confirmar atendimento");
    expect(nextOrderAction({ status: "Novo", operationalStatus: "Confirmado" })?.label).toBe("Confirmar pagamento");
    expect(nextOrderAction({ status: "Pago", operationalStatus: "Em preparação", paymentStatus: "Recebido" })?.label).toBe("Marcar como enviado");
    expect(nextOrderAction({ status: "Novo", operationalStatus: "Entregue", paymentStatus: "Parcial" })?.label).toBe("Registrar pagamento");
  });

  it("explica efeitos financeiros e exige motivo no cancelamento", () => {
    const order = { status: "Pago" as const, operationalStatus: "Em preparação" as const, paymentStatus: "Recebido" as const };
    expect(lifecycleChangeConsequences(order, "Cancelado", "Estornado").join(" ")).toContain("financeiro será estornado");
    expect(lifecycleReasonRequired(order, "Cancelado", "Estornado")).toBe(true);
  });

  it("exige motivo e preserva o saldo ao entregar sem quitação", () => {
    const order = { status: "Novo" as const, operationalStatus: "Enviado" as const, paymentStatus: "Parcial" as const };
    const consequences = lifecycleChangeConsequences(order, "Entregue", "Parcial").join(" ");
    expect(consequences).toContain("saldo em aberto");
    expect(consequences).toContain("estoque será baixado");
    expect(lifecycleReasonRequired(order, "Entregue", "Parcial")).toBe(true);
  });
});
