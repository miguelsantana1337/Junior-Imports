import { slugify } from "@/lib/format";
import { electronicsCategorySlug } from "@/lib/storefront-catalog-scope";
import type { Category, StorefrontProduct } from "@/types/store";

export { electronicsCategorySlug };

export function resolveElectronicsCatalog(
  products: StorefrontProduct[],
  categories: Category[],
) {
  const electronicsCategories = categories
    .filter((category) => category.active)
    .filter((category) => (category.slug || slugify(category.name)) === electronicsCategorySlug)
    .sort((a, b) => a.order - b.order);
  const categoryIds = new Set(electronicsCategories.map((category) => category.id));

  return {
    categories: electronicsCategories,
    products: products.filter((product) =>
      categoryIds.has(product.categoryId)
      || slugify(product.category) === electronicsCategorySlug,
    ),
  };
}
