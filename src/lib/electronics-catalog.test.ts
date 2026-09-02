import { describe, expect, it } from "vitest";
import { resolveElectronicsCatalog } from "./electronics-catalog";
import type { Category, StorefrontProduct } from "@/types/store";

const categories: Category[] = [
  { id: "cat-pharma", name: "Farmacêuticos", slug: "farmaceuticos", active: true, order: 1 },
  { id: "cat-electronics", name: "Eletrônicos", slug: "eletronicos", active: true, order: 2 },
  { id: "cat-hidden", name: "Eletrônicos antigos", slug: "eletronicos-antigos", active: false, order: 3 },
];

function product(overrides: Partial<StorefrontProduct>): StorefrontProduct {
  return {
    id: "product",
    slug: "product",
    name: "Produto",
    categoryId: "cat-pharma",
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

describe("vitrine exclusiva de eletrônicos", () => {
  it("exibe somente produtos vinculados à categoria Eletrônicos", () => {
    const result = resolveElectronicsCatalog([
      product({ id: "phone", name: "Smartphone", categoryId: "cat-electronics", category: "Eletrônicos" }),
      product({ id: "medicine", name: "Medicamento", categoryId: "cat-pharma", category: "Farmacêuticos" }),
      product({ id: "legacy", name: "Fone antigo", categoryId: "cat-hidden", category: "Eletrônicos antigos" }),
    ], categories);

    expect(result.categories.map((category) => category.id)).toEqual(["cat-electronics"]);
    expect(result.products.map((item) => item.id)).toEqual(["phone"]);
  });

  it("reconhece o nome da categoria quando o vínculo legado não possui ID válido", () => {
    const result = resolveElectronicsCatalog([
      product({ id: "watch", name: "Relógio", categoryId: "legacy-id", category: "Eletrônicos" }),
    ], categories);

    expect(result.products.map((item) => item.id)).toEqual(["watch"]);
  });
});
