import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import { sanitizeProductForStorefront } from "./storefront-product";

describe("catálogo público", () => {
  it("remove custo, estoque mínimo e SKU antes de serializar", () => {
    const internalProduct = cloneSeedData().products[0];
    const publicProduct = sanitizeProductForStorefront(internalProduct, 42);
    const serialized = JSON.stringify(publicProduct);

    expect(publicProduct.stock).toBe(10);
    expect(publicProduct.cashback).toBe(internalProduct.cashback);
    expect(serialized).not.toContain("costPrice");
    expect(serialized).not.toContain("minStock");
    expect(serialized).not.toContain('"sku"');
  });

  it("permite comprar até o saldo disponível, limitado a dez unidades", () => {
    const internalProduct = cloneSeedData().products[0];

    expect(sanitizeProductForStorefront(internalProduct, 4).stock).toBe(4);
    expect(sanitizeProductForStorefront(internalProduct, 8).stock).toBe(8);
    expect(sanitizeProductForStorefront(internalProduct, 42).stock).toBe(10);
  });
});
