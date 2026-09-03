import { slugify } from "@/lib/format";
import type { CatalogProductGroup, CatalogSort } from "@/lib/catalog-view";
import type { Category, StorefrontProduct } from "@/types/store";
import { groupElectronicsProductModels, type ElectronicsProductModel } from "@/lib/electronics-product-variants";

const families = [
  { id: "iphone", name: "iPhone", match: (name: string) => name.startsWith("iphone") },
  { id: "apple-watch", name: "Apple Watch", match: (name: string) => name.startsWith("apple watch") },
  { id: "ipad", name: "iPad", match: (name: string) => name.startsWith("ipad") },
  { id: "macbook", name: "MacBook", match: (name: string) => name.startsWith("macbook") },
  { id: "airpods", name: "AirPods", match: (name: string) => name.startsWith("airpods") },
  { id: "acessorios", name: "Acessórios", match: (name: string) => /^(apple pencil|airtag)\b/.test(name) },
] as const;

function modelOrder(model: ElectronicsProductModel) {
  return model.selection ? Math.min(...model.selection.options.map(({ product }) => product.order)) : model.product.order;
}

function sortModels(models: ElectronicsProductModel[], sort: CatalogSort) {
  return [...models].sort((a, b) => {
    if (sort === "price-asc") return a.product.price - b.product.price;
    if (sort === "price-desc") return b.product.price - a.product.price;
    if (sort === "name") return (a.selection?.name ?? a.product.name).localeCompare(b.selection?.name ?? b.product.name, "pt-BR");
    return modelOrder(a) - modelOrder(b);
  });
}

function searchText(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/(\d)\s+(gb|tb)\b/g, "$1$2");
}

export function electronicsProductFamily(product: StorefrontProduct) {
  const normalizedName = product.name.trim().toLocaleLowerCase("pt-BR");
  return families.find((family) => family.match(normalizedName))?.id ?? "outros-eletronicos";
}

export function buildElectronicsProductGroups(
  products: StorefrontProduct[],
  _categories: Category[],
  search: string,
  sort: CatalogSort,
): CatalogProductGroup[] {
  const term = searchText(search);
  // Search every capacity, but keep the complete model together in the results.
  const visibleModels = groupElectronicsProductModels(products).filter((model) => !term
    || (model.selection?.options.map(({ product }) => product) ?? [model.product])
      .some((product) => [product.name, product.brand, product.description].some((value) => searchText(value).includes(term))));

  const definitions = [
    ...families.map(({ id, name }) => ({ id, name })),
    { id: "outros-eletronicos", name: "Outros eletrônicos" },
  ];

  return definitions.flatMap(({ id, name }) => {
    const familyModels = sortModels(visibleModels.filter(({ product }) => electronicsProductFamily(product) === id), sort);
    return familyModels.length ? [{
      id: `electronics-${id}`,
      slug: slugify(name),
      name,
      products: familyModels.map(({ product }) => product),
      selections: Object.fromEntries(familyModels.flatMap(({ product, selection }) => selection ? [[product.id, selection]] : [])),
    }] : [];
  });
}
