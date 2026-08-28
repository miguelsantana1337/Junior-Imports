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
      promotionDiscount: 0,
      discount: 0,
      shipping: 0,
      shippingStatus: "pending",
      total: 0,
      cashback: 0,
      cashbackByProduct: {},
      promotionApplied: false,
      promotionApplications: [],
      promotionGifts: [],
      promotionStockIssue: "",
    });
  });

  it("aplica cupom, desconto Pix e frete gratis na ordem correta", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      { ...seedData.settings, promotionStartsAt: "2020-01-01T00:00:00.000Z", promotionEndsAt: "2099-12-31T23:59:59.000Z", pixDiscountMinimum: 0 },
      seedData.coupons[0],
      "Pix",
    );

    expect(result.subtotal).toBeCloseTo(649.9);
    expect(result.couponDiscount).toBeCloseTo(64.99);
    expect(result.paymentDiscount).toBeCloseTo(29.2455);
    expect(result.shipping).toBe(0);
    expect(result.total).toBeCloseTo(555.6645);
    expect(result.cashback).toBe(42.75);
  });

  it("limita quantidade e contagem ao estoque disponivel", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 999 }],
      seedData.products,
      seedData.settings,
    );

    expect(result.items).toBe(product.stock);
    expect(result.subtotal).toBeCloseTo(product.price * product.stock);
    expect(result.cashback).toBeCloseTo(product.cashback * product.stock);
  });

  it("cobra o frete fixo quando a regra de frete gratis esta desativada", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      { ...seedData.settings, freeShippingEnabled: false, shippingCityRates: [], quoteShippingOutsideCities: false },
    );

    expect(result.shipping).toBe(seedData.settings.shippingFlat);
    expect(result.shippingStatus).toBe("calculated");
  });

  it.each([
    ["Ipatinga", 10],
    ["coronel fabriciano", 20],
    ["Timoteo", 30],
  ])("aplica a tarifa configurada para %s", (city, expected) => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      { ...seedData.settings, freeShippingEnabled: false },
      null,
      undefined,
      [],
      { city, state: "MG" },
    );

    expect(result.shipping).toBe(expected);
    expect(result.shippingStatus).toBe("calculated");
  });

  it("deixa o frete para cotacao em cidades nao cadastradas", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      { ...seedData.settings, freeShippingEnabled: false },
      null,
      undefined,
      [],
      { city: "Belo Horizonte", state: "MG" },
    );

    expect(result.shipping).toBe(0);
    expect(result.shippingStatus).toBe("quote");
    expect(result.total).toBe(result.subtotal);
  });

  it("zera o frete quando o cliente escolhe retirada no local", () => {
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      { ...seedData.settings, freeShippingEnabled: false },
      null,
      undefined,
      [],
      { deliveryMethod: "pickup" },
    );

    expect(result.shipping).toBe(0);
    expect(result.shippingStatus).toBe("pickup");
    expect(result.total).toBe(result.subtotal);
  });

  it("aplica campanha de 1% sobre o valor dos produtos elegiveis", () => {
    const campaign = {
      ...seedData.cashbackCampaigns[0],
      multiplier: 1,
      fixedBonus: 0,
      targetSegments: [],
      productIds: [],
      startsAt: "2020-01-01T00:00:00.000Z",
      endsAt: "2099-12-31T23:59:59.000Z",
    };
    const result = calculateCart(
      [{ productId: product.id, quantity: 1 }],
      seedData.products,
      seedData.settings,
      null,
      undefined,
      [campaign],
    );

    expect(result.cashback).toBeCloseTo(product.price * 0.01);
  });

  it("calcula cashback sobre o total pago pelos produtos sem incluir o frete", () => {
    const item = { ...product, price: 2200, compareAt: 2200, cashback: 50, cashbackType: "fixed" as const, stock: 1 };
    const coupon = {
      ...seedData.coupons[0],
      type: "fixed" as const,
      value: 1300,
      minimum: 0,
      applicableCategoryIds: [],
      applicableProductIds: [],
    };
    const campaign = {
      ...seedData.cashbackCampaigns[0],
      multiplier: 1,
      fixedBonus: 0,
      targetSegments: [],
      productIds: [],
      startsAt: "2020-01-01T00:00:00.000Z",
      endsAt: "2099-12-31T23:59:59.000Z",
    };
    const result = calculateCart(
      [{ productId: item.id, quantity: 1 }],
      [item],
      { ...seedData.settings, pixDiscount: 0, freeShippingEnabled: false, shippingCityRates: [], quoteShippingOutsideCities: false, shippingFlat: 10 },
      coupon,
      "Pix",
      [campaign],
    );

    expect(result.total).toBe(910);
    expect(result.cashback).toBe(9);
    expect(result.cashbackByProduct[item.id]).toBe(9);
  });

  it("aceita cashback percentual no produto quando nao existe campanha", () => {
    const item = { ...product, price: 100, cashback: 5, cashbackType: "percent" as const, stock: 1 };
    const coupon = { ...seedData.coupons[0], type: "percent" as const, value: 20, minimum: 0, applicableCategoryIds: [], applicableProductIds: [] };
    const result = calculateCart(
      [{ productId: item.id, quantity: 1 }],
      [item],
      { ...seedData.settings, pixDiscount: 0, freeShippingEnabled: false, shippingFlat: 0, shippingCityRates: [], quoteShippingOutsideCities: false },
      coupon,
    );

    expect(result.total).toBe(80);
    expect(result.cashback).toBe(4);
  });

  it("aplica 5% no Pix somente quando o valor minimo da campanha e atingido", () => {
    const item = { ...product, price: 1000, compareAt: 1000, stock: 2 };
    const settings = {
      ...seedData.settings,
      promotionEnabled: true,
      promotionStartsAt: "2020-01-01T00:00:00.000Z",
      promotionEndsAt: "2099-12-31T23:59:59.000Z",
      pixDiscount: 5,
      pixDiscountMinimum: 900,
      shippingCityRates: [],
      freeShippingEnabled: false,
      shippingFlat: 0,
    };

    expect(calculateCart([{ productId: item.id, quantity: 1 }], [item], settings, null, "Pix").paymentDiscount).toBe(50);
    expect(calculateCart([{ productId: item.id, quantity: 1 }], [{ ...item, price: 899 }], settings, null, "Pix").paymentDiscount).toBe(0);
  });

  it("encerra Pix, frete gratis e cashback junto com suas janelas", () => {
    const item = { ...product, price: 1000, compareAt: 1000, stock: 1, cashback: 0 };
    const expiredSettings = {
      ...seedData.settings,
      promotionEnabled: true,
      promotionStartsAt: "2020-01-01T00:00:00.000Z",
      promotionEndsAt: "2020-01-07T23:59:59.000Z",
      pixDiscount: 5,
      pixDiscountMinimum: 0,
      freeShippingEnabled: true,
      freeShippingThreshold: 500,
      shippingCityRates: [],
      quoteShippingOutsideCities: false,
      shippingFlat: 20,
    };
    const expiredCampaign = {
      ...seedData.cashbackCampaigns[0],
      status: "active" as const,
      startsAt: "2020-01-01T00:00:00.000Z",
      endsAt: "2020-01-07T23:59:59.000Z",
      multiplier: 5,
      fixedBonus: 0,
      targetSegments: [],
      productIds: [],
    };
    const result = calculateCart([{ productId: item.id, quantity: 1 }], [item], expiredSettings, null, "Pix", [expiredCampaign]);

    expect(result.paymentDiscount).toBe(0);
    expect(result.shipping).toBe(20);
    expect(result.cashback).toBe(0);
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
