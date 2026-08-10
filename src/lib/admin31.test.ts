import { describe, expect, it } from "vitest";
import { bundleAvailability, normalizeFunnelProgress, parseMobileOperationDraft, simulateCampaignGuardian } from "./admin31";

describe("Admin 3.1", () => {
  it("calcula cashback depois do cupom e sem frete", () => {
    const result = simulateCampaignGuardian({
      lines: [{ productId: "p1", name: "Produto", price: 100, cost: 40, quantity: 1 }],
      coupon: { type: "percent", value: 10 },
      cashbackPercent: 10,
      cashbackFixed: 0,
      shipping: 20,
      minimumMarginPercent: 20,
    });
    expect(result.paidProducts).toBe(90);
    expect(result.cashbackBase).toBe(90);
    expect(result.cashback).toBe(9);
    expect(result.customerTotal).toBe(110);
    expect(result.margin).toBe(41);
    expect(result.decision).toBe("approved");
  });

  it("bloqueia campanha sem custo cadastrado", () => {
    const result = simulateCampaignGuardian({
      lines: [{ productId: "p1", name: "Produto", price: 100, cost: null, quantity: 1 }],
      cashbackPercent: 1,
      cashbackFixed: 0,
      shipping: 0,
      minimumMarginPercent: 10,
    });
    expect(result.decision).toBe("blocked");
    expect(result.warnings[0]).toContain("sem custo");
  });

  it("calcula disponibilidade agregada do kit", () => {
    expect(bundleAvailability([3, 2, 4], 4)).toBe(2);
    expect(bundleAvailability([1], 0)).toBe(0);
  });

  it("remove eventos duplicados e preserva a ordem do funil", () => {
    expect(normalizeFunnelProgress(["paid", "added_to_cart", "paid", "product_viewed"]))
      .toEqual(["product_viewed", "added_to_cart", "paid"]);
  });

  it("transforma voz em rascunho sem executar", () => {
    expect(parseMobileOperationDraft("saída 3 Lipoland")).toMatchObject({
      intent: "inventory_movement",
      quantity: 3,
      entity: "Lipoland",
      ambiguous: false,
    });
    expect(parseMobileOperationDraft("faça alguma coisa").ambiguous).toBe(true);
  });
});
