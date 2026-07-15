import { describe, expect, it } from "vitest";
import { calculateCart, discountPercent, isCouponValid, stockLabel } from "./commerce";
import { seedData } from "@/data/seed";

describe("calculateCart", () => {
  const product = seedData.products[0];

  it("mantem o carrinho vazio sem frete ou total", () => {
    expect(calculateCart([], seedData.products, seedData.settings)).toEqual({
      items: 0,
      subtotal: 0,
      couponDiscount: 0,
      paymentDiscount: 0,
      discount: 0,
      shipping: 0,
      total: 0,
    });
  });

  it("aplica cupom, desconto Pix e frete gratis na ordem correta", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      seedData.settings,
      seedData.coupons[0],
      "Pix",
    );

    expect(result.subtotal).toBeCloseTo(649.9);
    expect(result.couponDiscount).toBeCloseTo(64.99);
    expect(result.paymentDiscount).toBeCloseTo(29.2455);
    expect(result.shipping).toBe(0);
    expect(result.total).toBeCloseTo(555.6645);
  });

  it("limita quantidade e contagem ao estoque disponivel", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 999 }],
      seedData.products,
      seedData.settings,
    );

    expect(result.items).toBe(product.stock);
    expect(result.subtotal).toBeCloseTo(product.price * product.stock);
  });

  it("cobra o frete fixo quando a regra de frete gratis esta desativada", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      { ...seedData.settings, freeShippingEnabled: false },
    );

    expect(result.shipping).toBe(seedData.settings.shippingFlat);
  });
});

describe("regras auxiliares", () => {
  it("rejeita cupom expirado", () => {
    expect(
      isCouponValid(
        { ...seedData.coupons[0], expiresAt: "2025-01-01" },
        1000,
        new Date("2026-07-13T12:00:00"),
      ),
    ).toBe(false);
  });

  it("informa estoque e percentual de desconto", () => {
    expect(stockLabel({ ...seedData.products[0], stock: 0 })).toEqual({ label: "Esgotado", tone: "out" });
    expect(discountPercent({ ...seedData.products[0], price: 80, compareAt: 100 })).toBe(20);
  });
});
