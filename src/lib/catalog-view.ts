import { slugify } from "@/lib/format";
import type { Category, StorefrontProduct } from "@/types/store";

export type CatalogSort = "order" | "price-asc" | "price-desc" | "name";

export interface CatalogProductGroup {
  id: string;
  slug: string;
  name: string;
  products: StorefrontProduct[];
}

function sortProducts(products: StorefrontProduct[], sort: CatalogSort) {
  return [...products].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
    return a.order - b.order;
  });
}

export function buildCatalogProductGroups(
  products: StorefrontProduct[],
  categories: Category[],
  search: string,
  sort: CatalogSort,
) {
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = products
    .filter((product) => product.active)
    .filter((product) =>
      !term || [product.name, product.category, product.brand, product.description]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(term)),
    );
  const orderedCategories = categories
    .filter((category) => category.active)
    .sort((a, b) => a.order - b.order);
  const activeCategoryIds = new Set(orderedCategories.map((category) => category.id));
  const assignedProductIds = new Set<string>();
  const groups: CatalogProductGroup[] = [];

  orderedCategories.forEach((category) => {
    const categoryProducts = visibleProducts.filter((product) =>
      product.categoryId === category.id
      || (!activeCategoryIds.has(product.categoryId) && product.category === category.name),
    );
    if (!categoryProducts.length) return;
    categoryProducts.forEach((product) => assignedProductIds.add(product.id));
    groups.push({
      id: category.id,
      slug: category.slug || slugify(category.name),
      name: category.name,
      products: sortProducts(categoryProducts, sort),
    });
  });

  const remainingByName = new Map<string, StorefrontProduct[]>();
  visibleProducts
    .filter((product) => !assignedProductIds.has(product.id))
    .forEach((product) => {
      const categoryName = product.category.trim() || "Outros produtos";
      remainingByName.set(categoryName, [...(remainingByName.get(categoryName) ?? []), product]);
    });

  remainingByName.forEach((categoryProducts, name) => {
    groups.push({
      id: `fallback-${slugify(name) || "outros"}`,
      slug: slugify(name) || "outros",
      name,
      products: sortProducts(categoryProducts, sort),
    });
  });

  return groups;
}
