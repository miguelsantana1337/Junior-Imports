import { describe, expect, it } from "vitest";
import type { Product } from "@/types/store";
import { canAddProductToCart, getProductComplianceIssues, isProductPubliclySellable, isProductVisibleInCatalog, productPublicationLabel } from "./product-compliance";

const base: Product = {
  id: "produto",
  slug: "produto",
  name: "Produto",
  categoryId: "categoria",
  category: "Categoria",
  brand: "Marca",
  price: 10,
  compareAt: 0,
  costPrice: 6,
  stock: 1,
  minStock: 1,
  badge: "",
  accent: "#1677ff",
  description: "Descrição suficiente para o produto.",
  sku: "SKU-1",
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
  pharmacistReviewed: true,
};

describe("publicação responsável de produtos", () => {
  it("permite item não medicamentoso liberado", () => {
    expect(isProductPubliclySellable(base)).toBe(true);
  });

  it("mantém produto sem validação visível para consulta, mas fora do carrinho", () => {
    const pending = { ...base, regulatoryStatus: "pending" as const };
    expect(isProductVisibleInCatalog(pending)).toBe(true);
    expect(isProductPubliclySellable(pending)).toBe(false);
    expect(productPublicationLabel(pending)).toBe("Visível para consulta");
    expect(canAddProductToCart(pending, "demo")).toBe(false);
  });

  it("permite organizar no carrinho uma solicitação que será confirmada pelo WhatsApp", () => {
    const pending = { ...base, productType: "unclassified" as const, regulatoryStatus: "pending" as const };
    expect(canAddProductToCart(pending, "whatsapp")).toBe(true);
  });

  it("mantém produtos bloqueados ou sem estoque fora do carrinho", () => {
    expect(canAddProductToCart({ ...base, regulatoryStatus: "blocked" }, "whatsapp")).toBe(false);
    expect(canAddProductToCart({ ...base, stock: 0 }, "whatsapp")).toBe(false);
  });

  it("mantém produtos ocultos fora do catálogo", () => {
    expect(isProductVisibleInCatalog({ ...base, active: false })).toBe(false);
  });

  it("bloqueia medicamento sob prescrição na vitrine pública", () => {
    const issues = getProductComplianceIssues({ ...base, productType: "prescription" });
    expect(issues.some((issue) => issue.includes("vitrine pública"))).toBe(true);
  });

  it("exige informações regulatórias completas para MIP", () => {
    expect(getProductComplianceIssues({ ...base, productType: "otc", pharmacistReviewed: false })).toHaveLength(5);
    expect(isProductPubliclySellable({
      ...base,
      productType: "otc",
      activeIngredient: "Substância exemplo",
      presentation: "Caixa com 20 unidades",
      anvisaRegistration: "1.2345.6789.001-0",
      regulatoryWarning: "SE PERSISTIREM OS SINTOMAS, O MÉDICO DEVERÁ SER CONSULTADO.",
    })).toBe(true);
  });
});
