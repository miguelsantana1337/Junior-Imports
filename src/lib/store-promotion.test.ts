import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { isCardInstallmentEligible, isPixDiscountEligible, isStorePromotionActive } from "./store-promotion";

describe("campanha temporaria da loja", () => {
  const active = {
    ...seedData.settings,
    promotionEnabled: true,
    promotionStartsAt: "2026-08-19T03:00:00.000Z",
    promotionEndsAt: "2026-08-24T02:59:59.000Z",
    pixDiscount: 5,
    pixDiscountMinimum: 900,
    cardInstallments: 2,
    cardInstallmentMinimum: 950,
  };

  it("respeita inicio e fim da semana", () => {
    expect(isStorePromotionActive(active, new Date("2026-08-20T12:00:00.000Z"))).toBe(true);
    expect(isStorePromotionActive(active, new Date("2026-08-24T03:00:00.000Z"))).toBe(false);
  });

  it("respeita os valores minimos de Pix e parcelamento", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    expect(isPixDiscountEligible(active, 899.99, now)).toBe(false);
    expect(isPixDiscountEligible(active, 900, now)).toBe(true);
    expect(isCardInstallmentEligible(active, 949.99, now)).toBe(false);
    expect(isCardInstallmentEligible(active, 950, now)).toBe(true);
  });
});
