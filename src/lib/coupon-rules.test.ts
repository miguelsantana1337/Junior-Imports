import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { validateCouponForCustomer } from "./coupon-rules";

describe("limites de cupom por cliente", () => {
  it("identifica utilização anterior pelo e-mail ou telefone", () => {
    const coupon = { ...seedData.coupons[0], firstOrderOnly: false, usageCount: 0 };
    const result = validateCouponForCustomer(coupon, seedData.orders[0].customer, seedData.orders, []);
    expect(result).toEqual({ valid: false, message: "Este cupom já atingiu o limite de uso para este cliente." });
  });

  it("permite cliente ainda não identificado no histórico", () => {
    const coupon = { ...seedData.coupons[0], firstOrderOnly: false, usageCount: 0 };
    const result = validateCouponForCustomer(coupon, { email: "novo@exemplo.com", phone: "31988887777" }, seedData.orders, []);
    expect(result.valid).toBe(true);
  });

  it("bloqueia quando a campanha atinge o limite total", () => {
    const coupon = { ...seedData.coupons[0], totalUsageLimit: 1, usageCount: 1, firstOrderOnly: false };
    const result = validateCouponForCustomer(coupon, { email: "novo@exemplo.com", phone: "31988887777" }, [], []);
    expect(result.valid).toBe(false);
  });
});
