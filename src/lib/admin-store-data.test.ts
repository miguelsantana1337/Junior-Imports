import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import {
  mergeStorefrontIntoStoredData,
  normalizeAdminStoreData,
} from "./admin-store-data";
import { sanitizeProductForStorefront } from "./storefront-product";

describe("compatibilidade dos dados administrativos locais", () => {
  it("restaura coleções administrativas ausentes em dados antigos", () => {
    const legacy = {
      tenant: seedData.tenant,
      settings: { storeName: "Loja preservada" },
      products: seedData.products,
      orders: seedData.orders,
    };

    const normalized = normalizeAdminStoreData(legacy, seedData);

    expect(normalized.settings.storeName).toBe("Loja preservada");
    expect(normalized.customers).toEqual(seedData.customers);
    expect(normalized.purchaseOrders).toEqual(seedData.purchaseOrders);
    expect(normalized.auditLogs).toEqual(seedData.auditLogs);
  });

  it("assume cashback zero em produtos e pedidos salvos antes da campanha", () => {
    const product = { ...seedData.products[0] } as Record<string, unknown>;
    const order = { ...seedData.orders[0], items: seedData.orders[0].items.map((item) => ({ ...item })) } as Record<string, unknown>;
    delete product.cashback;
    delete order.cashbackTotal;
    (order.items as Array<Record<string, unknown>>).forEach((item) => delete item.unitCashback);

    const normalized = normalizeAdminStoreData({ products: [product], orders: [order] }, seedData);

    expect(normalized.products[0].cashback).toBe(0);
    expect(normalized.orders[0].cashbackTotal).toBe(0);
    expect(normalized.orders[0].items[0].unitCashback).toBe(0);
  });

  it("mantém campos privados dos produtos ao sincronizar a vitrine", () => {
    const storefront = {
      tenant: seedData.tenant,
      settings: seedData.settings,
      products: seedData.products.map((product) => sanitizeProductForStorefront(product)),
      categories: seedData.categories,
      banners: seedData.banners,
      sections: seedData.sections,
      pages: seedData.pages,
      pageBlocks: seedData.pageBlocks,
      trustItems: seedData.trustItems,
      benefits: seedData.benefits,
      faqs: seedData.faqs,
      orders: seedData.orders,
    };

    const merged = mergeStorefrontIntoStoredData(seedData, storefront);

    expect(merged.customers).toEqual(seedData.customers);
    expect(merged.products[0].costPrice).toBe(seedData.products[0].costPrice);
    expect(merged.products[0].minStock).toBe(seedData.products[0].minStock);
    expect(merged.products[0].sku).toBe(seedData.products[0].sku);
  });
});
