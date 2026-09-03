import type { CatalogProductSelection } from "@/lib/catalog-view";
import type { StorefrontProduct } from "@/types/store";

export interface ElectronicsProductModel {
  product: StorefrontProduct;
  selection?: CatalogProductSelection;
}

/** Only storage at the end of a device name is an option. Display size, RAM,
 * generation, Pro/Max and other model qualifiers remain part of its identity. */
export function electronicsStorageOption(product: StorefrontProduct) {
  if (product.productType !== "non_medicine" || !/^(iphone|ipad|macbook)\s/i.test(product.name.trim())) return null;
  const match = product.name.trim().match(/^(.*?)[\s/]+(\d+)\s*(GB|TB)$/i);
  if (!match || Number(match[2]) <= 0) return null;
  const name = match[1].trim();
  const unit = match[3].toUpperCase();
  const capacity = Number(match[2]);
  return {
    name,
    label: `${capacity} ${unit}`,
    gigabytes: capacity * (unit === "TB" ? 1024 : 1),
    key: JSON.stringify([product.categoryId, product.brand, name].map((value) => value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"))),
  };
}

/** A model is a storefront view, never a new SKU. All options retain their
 * existing ID, price, availability and URL, including historical order links. */
export function groupElectronicsProductModels(products: StorefrontProduct[]): ElectronicsProductModel[] {
  const groups = new Map<string, StorefrontProduct[]>();
  for (const product of products.filter((item) => item.active)) {
    const option = electronicsStorageOption(product);
    const key = option?.key ?? `product:${product.id}`;
    groups.set(key, [...(groups.get(key) ?? []), product]);
  }
  return [...groups.values()].flatMap((items) => {
    const options = items.map((product) => ({ product, storage: electronicsStorageOption(product) }));
    // A repeated capacity can indicate a different color or condition. Do not
    // guess that these are interchangeable devices or hide either listing.
    if (items.length < 2 || options.some((item) => !item.storage)
      || new Set(options.map((item) => item.storage!.gigabytes)).size !== items.length) {
      return items.map((product) => ({ product }));
    }
    const ordered = [...options].sort((a, b) => a.storage!.gigabytes - b.storage!.gigabytes);
    const available = items.filter((item) => item.stock > 0 && item.regulatoryStatus !== "blocked");
    const representative = [...(available.length ? available : items)]
      .sort((a, b) => a.price - b.price || a.order - b.order || a.id.localeCompare(b.id))[0];
    return [{
      product: representative,
      selection: {
        name: ordered[0].storage!.name,
        options: ordered.map(({ product, storage }) => ({ product, label: storage!.label })),
      },
    }];
  });
}
