import { describe, expect, it } from "vitest";
import type { StorefrontProduct } from "@/types/store";
import {
  buildElectronicsProductStructuredData,
  buildElectronicsWebsiteStructuredData,
  defaultElectronicsStorefrontUrl,
  electronicsStorefrontUrl,
  isIndexableElectronicsPath,
  isOfficialElectronicsHost,
  serializeJsonLd,
  storefrontRobotsHeader,
} from "./storefront-seo";

function product(overrides: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return {
    id: "iphone-256",
    slug: "iphone-17-pro-256gb",
    name: "iPhone 17 Pro 256GB",
    categoryId: "electronics",
    category: "Eletrônicos",
    brand: "Apple",
    price: 7800,
    compareAt: 0,
    cashback: 0,
    cashbackType: "fixed",
    stock: 10,
    badge: "",
    accent: "#1677ff",
    description: "iPhone 17 Pro sob encomenda.",
    rating: 0,
    reviews: 0,
    featured: true,
    active: true,
    order: 1,
    imageUrl: "https://cdn.example.com/iphone.jpg",
    imageUrls: ["https://cdn.example.com/iphone.jpg"],
    productType: "non_medicine",
    regulatoryStatus: "approved",
    activeIngredient: "",
    anvisaRegistration: "",
    presentation: "",
    regulatoryWarning: "",
    pharmacistReviewed: false,
    madeToOrder: true,
    ...overrides,
  };
}

describe("SEO separado da loja de eletrônicos", () => {
  it("reconhece apenas o domínio oficial e os caminhos públicos elegíveis", () => {
    expect(isOfficialElectronicsHost("www.juniorimportsoficial.com.br:443")).toBe(true);
    expect(isOfficialElectronicsHost("farmaceuticos.juniorimportsoficial.com.br")).toBe(false);
    expect(isOfficialElectronicsHost("junior-imports.vercel.app")).toBe(false);
    expect(isIndexableElectronicsPath("/")).toBe(true);
    expect(isIndexableElectronicsPath("/produtos/iphone-17-pro-256gb")).toBe(true);
    expect(isIndexableElectronicsPath("/checkout")).toBe(false);
    expect(isIndexableElectronicsPath("/pedidos/JI-1001")).toBe(false);
    expect(storefrontRobotsHeader("www.juniorimportsoficial.com.br", "/")).toContain("index, follow");
    expect(storefrontRobotsHeader("farmaceuticos.juniorimportsoficial.com.br", "/")).toBe("noindex, nofollow");
  });

  it("gera URLs canônicas somente no domínio oficial", () => {
    expect(electronicsStorefrontUrl()).toBe(`${defaultElectronicsStorefrontUrl}/`);
    expect(electronicsStorefrontUrl("/produtos/exemplo")).toBe(`${defaultElectronicsStorefrontUrl}/produtos/exemplo`);
  });

  it("descreve capacidades como variações do mesmo produto", () => {
    const products = [
      product(),
      product({ id: "iphone-512", slug: "iphone-17-pro-512gb", name: "iPhone 17 Pro 512GB", price: 9350 }),
    ];
    const schema = buildElectronicsProductStructuredData(products[0], products, "Junior Imports") as Record<string, unknown>;
    expect(schema["@type"]).toBe("ProductGroup");
    expect(schema.variesBy).toBe("https://schema.org/size");
    expect(schema.hasVariant).toHaveLength(2);
    expect(JSON.stringify(schema)).toContain("BackOrder");
    expect(JSON.stringify(schema)).not.toContain("Farmac");
  });

  it("lista na home os mesmos modelos consolidados da vitrine", () => {
    const schema = buildElectronicsWebsiteStructuredData({
      storeName: "Junior Imports",
      logoUrl: "/logo.png",
      products: [product(), product({ id: "iphone-512", slug: "iphone-17-pro-512gb", name: "iPhone 17 Pro 512GB" })],
    });
    const list = schema["@graph"].find((entry) => entry["@type"] === "ItemList");
    expect(list?.numberOfItems).toBe(1);
    expect(JSON.stringify(schema)).toContain("SearchAction");
  });

  it("neutraliza tags HTML ao serializar JSON-LD", () => {
    expect(serializeJsonLd({ name: "</script><script>" })).not.toContain("<");
  });
});
