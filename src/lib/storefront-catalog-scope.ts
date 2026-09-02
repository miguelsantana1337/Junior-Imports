import { slugify } from "@/lib/format";
import type { Category, StorefrontData, StorefrontProduct } from "@/types/store";

export type StorefrontCatalogScope = "all" | "electronics" | "pharmaceutical";

export const electronicsCategorySlug = "eletronicos";
export const pharmaceuticalScopeHeader = "x-storefront-scope";
export const electronicsDescription = "Eletrônicos selecionados pela Junior Imports. Escolha seu produto e confirme os detalhes pelo WhatsApp.";

export function storefrontCatalogScopeFromHeader(value: string | null | undefined): StorefrontCatalogScope {
  if (value === "electronics" || value === "pharmaceutical") return value;
  return "all";
}

function isElectronicsCategory(category: Category) {
  return (category.slug || slugify(category.name)) === electronicsCategorySlug;
}

export function isElectronicsProduct(product: StorefrontProduct, categories: Category[]) {
  const electronicsCategoryIds = new Set(
    categories.filter(isElectronicsCategory).map((category) => category.id),
  );
  return electronicsCategoryIds.has(product.categoryId)
    || slugify(product.category) === electronicsCategorySlug;
}

export function resolveStorefrontCatalogScope(
  products: StorefrontProduct[],
  categories: Category[],
  scope: StorefrontCatalogScope,
) {
  if (scope === "all") return { products, categories };

  const categoryMatches = (category: Category) => {
    const electronics = isElectronicsCategory(category);
    return scope === "electronics" ? electronics : !electronics;
  };
  const productMatches = (product: StorefrontProduct) => {
    const electronics = isElectronicsProduct(product, categories);
    return scope === "electronics" ? electronics : !electronics;
  };

  return {
    categories: categories.filter(categoryMatches),
    products: products.filter(productMatches),
  };
}

// Filter before serialization as well as in the client provider. Hiding cards
// alone would still send the other catalog in the public RSC payload.
export function scopeStorefrontData(data: StorefrontData, scope: StorefrontCatalogScope): StorefrontData {
  if (scope === "all") return data;
  const catalog = resolveStorefrontCatalogScope(data.products, data.categories, scope);
  const productIds = new Set(catalog.products.map((product) => product.id));
  const scoped = {
    ...data,
    ...catalog,
    orders: data.orders.filter((order) => order.items.length > 0
      && order.items.every((item) => productIds.has(item.productId))),
    productReviews: data.productReviews.filter((review) => productIds.has(review.productId)),
    bundles: data.bundles.filter((bundle) => productIds.has(bundle.productId)
      && bundle.options.every((option) => productIds.has(option.productId))),
    cashbackCampaigns: data.cashbackCampaigns
      .filter((campaign) => !campaign.productIds.length || campaign.productIds.some((id) => productIds.has(id)))
      .map((campaign) => ({
        ...campaign,
        productIds: campaign.productIds.filter((id) => productIds.has(id)),
      })),
  };
  if (scope !== "electronics") return scoped;

  // The existing visual editor and its institutional content belong to the
  // original catalog. Do not publish that content on the electronics home.
  return {
    ...scoped,
    banners: [], sections: [], pages: [], pageBlocks: [],
    trustItems: [], benefits: [], faqs: [],
    cashbackCampaigns: scoped.cashbackCampaigns.map((campaign) => ({
      ...campaign, name: "Cashback da loja", description: "",
    })),
    settings: {
      ...data.settings,
      announcement: "Eletrônicos selecionados pela Junior Imports.",
      footerDescription: electronicsDescription,
      freeShippingBannerButtonLink: "#catalogo",
      promotionName: "Condições da loja",
      promotionHighlights: [],
      quantityPromotion: {
        ...data.settings.quantityPromotion,
        singleProductId: productIds.has(data.settings.quantityPromotion.singleProductId) ? data.settings.quantityPromotion.singleProductId : "",
        boxProductId: productIds.has(data.settings.quantityPromotion.boxProductId) ? data.settings.quantityPromotion.boxProductId : "",
        doseProductId: productIds.has(data.settings.quantityPromotion.doseProductId) ? data.settings.quantityPromotion.doseProductId : "",
      },
    },
  };
}

export function storefrontStorageKey(tenantId: string, scope: StorefrontCatalogScope, resource: string) {
  const namespace = scope === "all" ? tenantId : `${tenantId}:${scope}`;
  return `${namespace}:${resource}:v1`;
}
