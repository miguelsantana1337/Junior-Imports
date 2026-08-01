import { describe, expect, it } from "vitest";
import type { Category, StorefrontProduct } from "@/types/store";
import { buildCatalogProductGroups } from "./catalog-view";

const categories: Category[] = [
  { id: "cat-b", name: "Categoria B", slug: "categoria-b", active: true, order: 2 },
  { id: "cat-a", name: "Categoria A", slug: "categoria-a", active: true, order: 1 },
  { id: "cat-hidden", name: "Categoria antiga", slug: "categoria-antiga", active: false, order: 3 },
];

function product(id: string, categoryId: string, category: string, price: number, order: number): StorefrontProduct {
  return {
    id,
    slug: id,
    name: `Produto ${id}`,
    categoryId,
    category,
    brand: "Marca",
    price,
    compareAt: price,
    cashback: 0,
    cashbackType: "fixed",
    stock: 5,
    badge: "",
    accent: "#1677ff",
    description: `Descrição do produto ${id}`,
    rating: 5,
    reviews: 1,
    featured: false,
    active: true,
    order,
    imageUrl: "",
    imageUrls: [],
    productType: "non_medicine",
    regulatoryStatus: "approved",
    activeIngredient: "",
    anvisaRegistration: "",
    presentation: "",
    regulatoryWarning: "",
    pharmacistReviewed: false,
  };
}

describe("catálogo agrupado por categoria", () => {
  const products = [
    product("b", "cat-b", "Categoria B", 30, 2),
    product("a2", "cat-a", "Categoria A", 20, 2),
    product("a1", "cat-a", "Categoria A", 10, 1),
    product("legado", "cat-hidden", "Categoria antiga", 40, 1),
  ];

  it("respeita a ordem das categorias e dos produtos", () => {
    const groups = buildCatalogProductGroups(products, categories, "", "order");

    expect(groups.map((group) => group.name)).toEqual(["Categoria A", "Categoria B"]);
    expect(groups[0]?.products.map((item) => item.id)).toEqual(["a1", "a2"]);
  });

  it("remove da vitrine produtos ligados a categorias ocultas", () => {
    const groups = buildCatalogProductGroups(products, categories, "", "order");
    expect(groups.flatMap((group) => group.products).map((item) => item.id)).not.toContain("legado");
  });

  it("mantém produtos antigos cuja categoria ainda não existe no cadastro", () => {
    const legacy = product("sem-categoria", "cat-removida", "Categoria removida", 50, 1);
    const groups = buildCatalogProductGroups([...products, legacy], categories, "", "order");
    expect(groups.flatMap((group) => group.products).map((item) => item.id)).toContain("sem-categoria");
  });

  it("aplica busca e ordenação dentro de cada carrossel", () => {
    const groups = buildCatalogProductGroups(products, categories, "produto a", "price-desc");
    expect(groups).toHaveLength(1);
    expect(groups[0]?.products.map((item) => item.id)).toEqual(["a2", "a1"]);
  });
});
