import { slugify } from "@/lib/format";
import type { Category, StorefrontData, StorefrontProduct } from "@/types/store";
import { electronicsDescription, electronicsHomePageId, resolveElectronicsHome } from "@/lib/electronics-home";

export type StorefrontCatalogScope = "all" | "electronics" | "pharmaceutical";

export const electronicsCategorySlug = "eletronicos";
export const pharmaceuticalScopeHeader = "x-storefront-scope";
export { electronicsDescription };

export function storefrontCatalogScopeFromHeader(value: string | null | undefined): StorefrontCatalogScope {
  if (value === "electronics" || value === "pharmaceutical") return value;
  return "all";
}

function isElectronicsCategory(category: Category) {
  return (category.slug || slugify(category.name)) === electronicsCategorySlug;
}

// Editorial links created before the catalog moved must stay on its current
// host. Match only the known former origins, never third-party destinations.
function originalCatalogLink(href: string) {
  try {
    const url = new URL(href);
    const formerOrigins = [
      "https://junior-imports.vercel.app",
      "https://juniorimportsoficial.com.br",
      "https://www.juniorimportsoficial.com.br",
    ];
    if (!formerOrigins.includes(url.origin)) return href;
    const prefix = "/loja/junior-imports";
    const pathname = url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
      ? url.pathname.slice(prefix.length) || "/"
      : url.pathname;
    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return href;
  }
}

export function isElectronicsProduct(product: StorefrontProduct, categories: Category[]) {
  const electronicsCategoryIds = new Set(
    categories.filter(isElectronicsCategory).map((category) => category.id),
  );
  return electronicsCategoryIds.has(product.categoryId)
    || slugify(product.category) === electronicsCategorySlug;
}

export function resolveStorefrontCatalogScope<T extends StorefrontProduct>(
  products: T[],
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
  const homePageId = electronicsHomePageId(data.tenant.id);
  const electronicsContent = resolveElectronicsHome(data.tenant.id, data.pageBlocks);
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
  if (scope === "pharmaceutical") return {
    ...scoped,
    pages: scoped.pages.filter((page) => page.id !== homePageId),
    banners: scoped.banners.map((banner) => ({ ...banner, buttonLink: originalCatalogLink(banner.buttonLink) })),
    sections: scoped.sections.map((section) => ({ ...section, ...(section.buttonLink ? { buttonLink: originalCatalogLink(section.buttonLink) } : {}) })),
    pageBlocks: scoped.pageBlocks.filter((block) => block.pageId !== homePageId).map((block) => ({ ...block, buttonLink: originalCatalogLink(block.buttonLink) })),
    settings: {
      ...scoped.settings,
      freeShippingBannerButtonLink: originalCatalogLink(scoped.settings.freeShippingBannerButtonLink),
    },
  };

  // The existing visual editor and its institutional content belong to the
  // original catalog. Do not publish that content on the electronics home.
  return {
    ...scoped,
    banners: [], sections: [],
    pages: [],
    pageBlocks: data.pageBlocks.filter((block) => block.pageId === homePageId),
    trustItems: [], benefits: [], faqs: [],
    cashbackCampaigns: scoped.cashbackCampaigns.map((campaign) => ({
      ...campaign, name: "Cashback da loja", description: "",
    })),
    settings: {
      ...data.settings,
      announcement: electronicsContent.announcement.title,
      footerDescription: electronicsContent.footer.body,
      freeShippingBannerButtonLink: "#catalogo",
      promotionName: "Condições da loja",
      promotionHighlights: [],
      quantityPromotion: {
        ...data.settings.quantityPromotion,
        singleProductId: productIds.has(data.settings.quantityPromotion.singleProductId) ? data.settings.quantityPromotion.singleProductId : "",
        boxProductId: productIds.has(data.settings.quantityPromotion.boxProductId) ? data.settings.quantityPromotion.boxProductId : "",
        singleProductIds: data.settings.quantityPromotion.singleProductIds?.filter((productId) => productIds.has(productId)),
        boxProductMappings: data.settings.quantityPromotion.boxProductMappings?.filter((mapping) => (
          productIds.has(mapping.boxProductId) && productIds.has(mapping.giftProductId)
        )),
        doseProductId: productIds.has(data.settings.quantityPromotion.doseProductId) ? data.settings.quantityPromotion.doseProductId : "",
      },
    },
  };
}

export function storefrontStorageKey(tenantId: string, scope: StorefrontCatalogScope, resource: string) {
  const namespace = scope === "all" ? tenantId : `${tenantId}:${scope}`;
  return `${namespace}:${resource}:v1`;
}
