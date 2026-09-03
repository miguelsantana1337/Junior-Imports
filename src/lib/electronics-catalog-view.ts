import { slugify } from "@/lib/format";
import type { CatalogProductGroup, CatalogSort } from "@/lib/catalog-view";
import type { Category, StorefrontProduct } from "@/types/store";

const families = [
  { id: "iphone", name: "iPhone", match: (name: string) => name.startsWith("iphone") },
  { id: "apple-watch", name: "Apple Watch", match: (name: string) => name.startsWith("apple watch") },
  { id: "ipad", name: "iPad", match: (name: string) => name.startsWith("ipad") },
  { id: "macbook", name: "MacBook", match: (name: string) => name.startsWith("macbook") },
  { id: "airpods", name: "AirPods", match: (name: string) => name.startsWith("airpods") },
  { id: "acessorios", name: "Acessórios", match: (name: string) => /^(apple pencil|airtag)\b/.test(name) },
] as const;

function sortProducts(products: StorefrontProduct[], sort: CatalogSort) {
  return [...products].sort((a, b) => {
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
    return a.order - b.order;
  });
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
  const term = search.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = products
    .filter((product) => product.active)
    .filter((product) => !term || [product.name, product.brand, product.description]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(term)));

  const definitions = [
    ...families.map(({ id, name }) => ({ id, name })),
    { id: "outros-eletronicos", name: "Outros eletrônicos" },
  ];

  return definitions.flatMap(({ id, name }) => {
    const familyProducts = visibleProducts.filter((product) => electronicsProductFamily(product) === id);
    return familyProducts.length ? [{
      id: `electronics-${id}`,
      slug: slugify(name),
      name,
      products: sortProducts(familyProducts, sort),
    }] : [];
  });
}
