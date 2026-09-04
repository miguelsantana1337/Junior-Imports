import { describe, expect, it } from "vitest";
import { calculateCart } from "@/lib/commerce";
import { calculateQuantityPromotion } from "@/lib/quantity-promotion";
import { seedData } from "@/data/seed";
import type { StorefrontProduct, StoreSettings } from "@/types/store";

const single: StorefrontProduct = { ...seedData.products[0], id: "single", name: "TG 15 mg (1 ampola)", price: 450, stock: 30, cashback: 1, cashbackType: "percent" };
const box: StorefrontProduct = { ...seedData.products[1], id: "box", name: "TG 15 mg (4 ampolas)", price: 1_750, stock: 10, cashback: 1, cashbackType: "percent" };
const dose: StorefrontProduct = { ...seedData.products[2], id: "dose", name: "Tirzepatida 2,5 mg (1 dose na seringa)", price: 170, stock: 30, cashback: 0 };
const products = [single, box, dose];
const settings: StoreSettings = {
  ...seedData.settings,
  promotionEnabled: true,
  promotionStartsAt: "2026-08-01T00:00:00.000Z",
  promotionEndsAt: "2026-10-01T03:00:00.000Z",
  pixDiscount: 5,
  quantityPromotion: {
    enabled: true,
    singleProductId: single.id,
    boxProductId: box.id,
    doseProductId: dose.id,
    groupQuantity: 3,
    groupDiscountPercent: 50,
    doseGiftPerRemainder: 1,
    boxGiftQuantity: 1,
    repeatable: true,
    allowCoupons: false,
    allowAdditionalDiscounts: false,
  },
};

describe("promoção por quantidade", () => {
  it("entrega uma dose completa para uma ampola", () => {
    const result = calculateQuantityPromotion([{ productId: single.id, quantity: 1 }], products, settings);
    expect(result.discount).toBe(0);
    expect(result.gifts).toEqual([{ productId: dose.id, name: dose.name, quantity: 1 }]);
  });

  it("aplica 50% somente à terceira ampola, sem dose adicional", () => {
    const result = calculateQuantityPromotion([{ productId: single.id, quantity: 3 }], products, settings);
    expect(result.discount).toBe(225);
    expect(result.gifts).toEqual([]);
    expect(result.applications[0]).toMatchObject({ key: "group-discount", applications: 1 });
  });

  it("repete a regra em seis ampolas", () => {
    const result = calculateQuantityPromotion([{ productId: single.id, quantity: 6 }], products, settings);
    expect(result.discount).toBe(450);
    expect(result.applications[0]).toMatchObject({ applications: 2 });
  });

  it("combina um grupo com a dose da quarta ampola", () => {
    const result = calculateQuantityPromotion([{ productId: single.id, quantity: 4 }], products, settings);
    expect(result.discount).toBe(225);
    expect(result.gifts[0]).toMatchObject({ productId: dose.id, quantity: 1 });
  });

  it("reserva uma ampola grátis para cada caixa", () => {
    const result = calculateQuantityPromotion([{ productId: box.id, quantity: 2 }], products, settings);
    expect(result.gifts).toEqual([{ productId: single.id, name: single.name, quantity: 2 }]);
  });

  it("mantém cashback líquido e bloqueia cupom e Pix adicionais", () => {
    const coupon = { ...seedData.coupons[0], type: "percent" as const, value: 10, minimum: 0 };
    const result = calculateCart([{ productId: single.id, quantity: 3 }], products, settings, coupon, "Pix");
    expect(result.promotionDiscount).toBe(225);
    expect(result.couponDiscount).toBe(0);
    expect(result.paymentDiscount).toBe(0);
    expect(result.total - result.shipping).toBe(1_125);
    expect(result.cashback).toBe(11.25);
  });

  it("avisa quando o estoque do brinde não cobre o pedido", () => {
    const result = calculateQuantityPromotion(
      [{ productId: box.id, quantity: 2 }],
      [single, box, { ...dose, stock: 0 }, { ...single, stock: 1 }],
      settings,
    );
    expect(result.stockIssue).toContain("estoque suficiente");
  });

  it("aplica as regras por marca sem combinar quantidades de produtos diferentes", () => {
    const otherSingle = { ...single, id: "other-single", name: "Outra tirzepatida 15 mg", price: 480 };
    const multiSettings: StoreSettings = {
      ...settings,
      quantityPromotion: {
        ...settings.quantityPromotion,
        singleProductIds: [single.id, otherSingle.id],
      },
    };
    const result = calculateQuantityPromotion(
      [{ productId: single.id, quantity: 2 }, { productId: otherSingle.id, quantity: 1 }],
      [...products, otherSingle],
      multiSettings,
    );
    expect(result.discount).toBe(0);
    expect(result.gifts).toEqual([{ productId: dose.id, name: dose.name, quantity: 3 }]);
  });

  it("soma o desconto calculado separadamente para cada marca", () => {
    const otherSingle = { ...single, id: "other-single", name: "Outra tirzepatida 15 mg", price: 480 };
    const multiSettings: StoreSettings = {
      ...settings,
      quantityPromotion: {
        ...settings.quantityPromotion,
        singleProductIds: [single.id, otherSingle.id],
      },
    };
    const result = calculateQuantityPromotion(
      [{ productId: single.id, quantity: 3 }, { productId: otherSingle.id, quantity: 3 }],
      [...products, otherSingle],
      multiSettings,
    );
    expect(result.discount).toBe(465);
    expect(result.gifts).toEqual([]);
    expect(result.applications[0]).toMatchObject({ key: "group-discount", applications: 2 });
  });

  it("entrega a ampola da mesma marca para cada caixa", () => {
    const otherSingle = { ...single, id: "other-single", name: "Outra tirzepatida 15 mg", price: 480 };
    const otherBox = { ...box, id: "other-box", name: "Outra tirzepatida 15 mg (4 ampolas)", price: 1_850 };
    const multiSettings: StoreSettings = {
      ...settings,
      quantityPromotion: {
        ...settings.quantityPromotion,
        boxProductMappings: [
          { boxProductId: box.id, giftProductId: single.id },
          { boxProductId: otherBox.id, giftProductId: otherSingle.id },
        ],
      },
    };
    const result = calculateQuantityPromotion(
      [{ productId: box.id, quantity: 1 }, { productId: otherBox.id, quantity: 2 }],
      [...products, otherSingle, otherBox],
      multiSettings,
    );
    expect(result.gifts).toEqual([
      { productId: single.id, name: single.name, quantity: 1 },
      { productId: otherSingle.id, name: otherSingle.name, quantity: 2 },
    ]);
    expect(result.applications).toContainEqual(expect.objectContaining({ key: "box-gift", applications: 3 }));
  });
});
