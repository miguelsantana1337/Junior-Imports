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

  it("publica faixas de compra em vez do saldo exato", () => {
    const internalProduct = cloneSeedData().products[0];

    expect(sanitizeProductForStorefront(internalProduct, 4).stock).toBe(1);
    expect(sanitizeProductForStorefront(internalProduct, 8).stock).toBe(5);
    expect(sanitizeProductForStorefront(internalProduct, 42).stock).toBe(10);
  });
});
