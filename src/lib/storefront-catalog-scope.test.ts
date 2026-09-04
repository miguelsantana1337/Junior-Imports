import { describe, expect, it } from "vitest";
import type { Category, Order, StorefrontProduct } from "@/types/store";
import { seedData } from "@/data/seed";
import { calculateCart } from "@/lib/commerce";
import {
  resolveStorefrontCatalogScope,
  storefrontCatalogScopeFromHeader,
  scopeStorefrontData,
  storefrontStorageKey,
} from "./storefront-catalog-scope";

const categories: Category[] = [
  { id: "pharma", name: "Farmacêuticos", slug: "farmaceuticos", active: true, order: 1 },
  { id: "electronics", name: "Eletrônicos", slug: "eletronicos", active: true, order: 2 },
];

function product(overrides: Partial<StorefrontProduct>): StorefrontProduct {
  return {
    id: "product",
    slug: "product",
    name: "Produto",
    categoryId: "pharma",
    category: "Farmacêuticos",
    brand: "",
    price: 100,
    compareAt: 0,
    cashback: 0,
    cashbackType: "fixed",
    stock: 1,
    badge: "",
    accent: "#1677ff",
    description: "",
    rating: 0,
    reviews: 0,
    featured: false,
    active: true,
    order: 1,
    imageUrl: "",
    imageUrls: [],
    productType: "non_medicine",
    regulatoryStatus: "approved",
    activeIngredient: "",
    anvisaRegistration: "",
    presentation: "",
    regulatoryWarning: "",
    pharmacistReviewed: false,
    ...overrides,
  };
}

const products = [
  product({ id: "medicine", categoryId: "pharma", category: "Farmacêuticos" }),
  product({ id: "phone", categoryId: "electronics", category: "Eletrônicos" }),
  product({ id: "legacy-phone", categoryId: "legacy", category: "Eletrônicos" }),
];

describe("escopos públicos dos catálogos", () => {
  it("mantém somente eletrônicos na home oficial", () => {
    const result = resolveStorefrontCatalogScope(products, categories, "electronics");
    expect(result.categories.map((category) => category.id)).toEqual(["electronics"]);
    expect(result.products.map((item) => item.id)).toEqual(["phone", "legacy-phone"]);
  });

  it("remove eletrônicos do catálogo farmacêutico", () => {
    const result = resolveStorefrontCatalogScope(products, categories, "pharmaceutical");
    expect(result.categories.map((category) => category.id)).toEqual(["pharma"]);
    expect(result.products.map((item) => item.id)).toEqual(["medicine"]);
  });

  it("interpreta somente valores conhecidos no cabeçalho interno", () => {
    expect(storefrontCatalogScopeFromHeader("electronics")).toBe("electronics");
    expect(storefrontCatalogScopeFromHeader("pharmaceutical")).toBe("pharmaceutical");
    expect(storefrontCatalogScopeFromHeader("anything-else")).toBe("all");
  });

  it("não serializa conteúdo editorial do catálogo original na loja de eletrônicos", () => {
    const data = {
      ...seedData,
      products,
      categories,
      settings: {
        ...seedData.settings,
        quantityPromotion: {
          ...seedData.settings.quantityPromotion,
          singleProductIds: ["medicine"],
          boxProductMappings: [{ boxProductId: "medicine", giftProductId: "medicine" }],
        },
      },
    };
    const result = scopeStorefrontData(data, "electronics");
    expect(result.products.map((item) => item.id)).toEqual(["phone", "legacy-phone"]);
    for (const key of ["banners", "sections", "pages", "pageBlocks", "trustItems", "benefits", "faqs", "orders"] as const) {
      expect(result[key]).toEqual([]);
    }
    expect(JSON.stringify(result)).not.toContain('"medicine"');
    expect(result.settings.whatsapp).toBe(data.settings.whatsapp);
    expect(result.settings.quantityPromotion.singleProductId).toBe("");
    expect(result.settings.quantityPromotion.singleProductIds).toEqual([]);
    expect(result.settings.quantityPromotion.boxProductMappings).toEqual([]);
    expect(scopeStorefrontData(data, "all")).toBe(data);
  });

  it("preserva cálculos comerciais dos eletrônicos e o conteúdo do catálogo original", () => {
    const data = { ...seedData, products, categories };
    const scoped = scopeStorefrontData(data, "electronics");
    const lines = [{ productId: "phone", quantity: 1 }];
    expect(calculateCart(lines, scoped.products, scoped.settings, null, "Pix", scoped.cashbackCampaigns))
      .toEqual(calculateCart(lines, data.products, data.settings, null, "Pix", data.cashbackCampaigns));
    const pharma = scopeStorefrontData(data, "pharmaceutical");
    expect(pharma.banners).toEqual(data.banners);
    expect(pharma.settings).toEqual(data.settings);
  });

  it("mantém os links editoriais antigos no próprio catálogo, preservando buscas e âncoras", () => {
    const data = {
      ...seedData, products, categories,
      banners: [{ ...seedData.banners[0], buttonLink: "https://junior-imports.vercel.app/#catalogo" }],
      sections: [{ ...seedData.sections[0], buttonLink: "https://www.juniorimportsoficial.com.br/?busca=produto#catalogo" }],
      pageBlocks: [{ ...seedData.pageBlocks[0], buttonLink: "https://juniorimportsoficial.com.br/loja/junior-imports/paginas/como-comprar" }],
      settings: { ...seedData.settings, freeShippingBannerButtonLink: "https://junior-imports.vercel.app/loja/junior-imports#catalogo" },
    };
    const result = scopeStorefrontData(data, "pharmaceutical");
    expect(result.banners[0].buttonLink).toBe("/#catalogo");
    expect(result.sections[0].buttonLink).toBe("/?busca=produto#catalogo");
    expect(result.pageBlocks[0].buttonLink).toBe("/paginas/como-comprar");
    expect(result.settings.freeShippingBannerButtonLink).toBe("/#catalogo");
    expect(data.banners[0].buttonLink).toBe("https://junior-imports.vercel.app/#catalogo");
  });

  it("não reescreve WhatsApp, outros sites ou links relativos", () => {
    for (const href of ["https://wa.link/exemplo", "https://junior-imports.vercel.app.exemplo.com/#catalogo", "https://outro.com", "https://junior-imports.vercel.app:444/", "/#catalogo", "#catalogo", ""]) {
      const data = { ...seedData, banners: [{ ...seedData.banners[0], buttonLink: href }] };
      expect(scopeStorefrontData(data, "pharmaceutical").banners[0].buttonLink).toBe(href);
    }
  });

  it("não converte campanha específica do outro catálogo em campanha global", () => {
    const campaign = { id: "cash", name: "Campanha", description: "", status: "active" as const, startsAt: "", endsAt: "", multiplier: 1, fixedBonus: 0, creditValidDays: 30, priority: 1, targetSegments: [], productIds: ["medicine"], createdAt: "", updatedAt: "" };
    const data = { ...seedData, products, categories, cashbackCampaigns: [campaign, { ...campaign, id: "both", productIds: ["medicine", "phone"] }, { ...campaign, id: "global", productIds: [] }] };
    const result = scopeStorefrontData(data, "electronics");
    expect(result.cashbackCampaigns.map((item) => [item.id, item.productIds])).toEqual([["both", ["phone"]], ["global", []]]);
  });

  it("mantém carrinho, favoritos e sessão separados sem reutilizar o carrinho antigo", () => {
    for (const resource of ["cart", "favorites", "cart-session"]) {
      const keys = ["all", "electronics", "pharmaceutical"].map((scope) => storefrontStorageKey("tenant", scope as "all" | "electronics" | "pharmaceutical", resource));
      expect(new Set(keys).size).toBe(3);
      expect(keys[0]).toBe(`tenant:${resource}:v1`);
    }
  });

  it("mantém o pedido recém-criado na própria loja e não expõe pedidos do outro catálogo", () => {
    const order: Order = { id: "order", code: "TEST-1", customerId: "", customer: { name: "Teste", phone: "", email: "", zip: "", city: "", state: "", address: "", number: "", complement: "" }, createdAt: "", items: [{ productId: "phone", name: "Telefone", quantity: 1, unitPrice: 100, unitCost: 0, unitCashback: 0 }], subtotal: 100, discount: 0, shipping: 0, total: 100, cashbackTotal: 0, payment: "Pix", status: "Novo", couponCode: "", internalNotes: "", trackingCode: "" };
    const data = { ...seedData, products, categories, orders: [order] };
    expect(scopeStorefrontData(data, "electronics").orders).toEqual([order]);
    expect(scopeStorefrontData(data, "pharmaceutical").orders).toEqual([]);
  });
});
