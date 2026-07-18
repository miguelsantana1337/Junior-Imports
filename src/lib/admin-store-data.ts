import type { Order, Product, StoreData, StorefrontData, StorefrontProduct } from "@/types/store";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayOrFallback<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) ? value as T[] : fallback;
}

export function normalizeAdminStoreData(candidate: unknown, fallback: StoreData): StoreData {
  if (!isRecord(candidate)) return fallback;

  return {
    tenant: isRecord(candidate.tenant) ? { ...fallback.tenant, ...candidate.tenant } : fallback.tenant,
    settings: isRecord(candidate.settings) ? { ...fallback.settings, ...candidate.settings } : fallback.settings,
    products: arrayOrFallback<Product>(candidate.products, fallback.products).map((product) => ({ ...product, cashback: Number(product.cashback) || 0 })),
    categories: arrayOrFallback(candidate.categories, fallback.categories),
    banners: arrayOrFallback(candidate.banners, fallback.banners),
    sections: arrayOrFallback(candidate.sections, fallback.sections),
    pages: arrayOrFallback(candidate.pages, fallback.pages),
    pageBlocks: arrayOrFallback(candidate.pageBlocks, fallback.pageBlocks),
    coupons: arrayOrFallback(candidate.coupons, fallback.coupons),
    customers: arrayOrFallback(candidate.customers, fallback.customers),
    customerTasks: arrayOrFallback(candidate.customerTasks, fallback.customerTasks),
    customerContacts: arrayOrFallback(candidate.customerContacts, fallback.customerContacts),
    cashbackCampaigns: arrayOrFallback(candidate.cashbackCampaigns, fallback.cashbackCampaigns),
    cashbackEntries: arrayOrFallback(candidate.cashbackEntries, fallback.cashbackEntries),
    couponRedemptions: arrayOrFallback(candidate.couponRedemptions, fallback.couponRedemptions),
    catalogImports: arrayOrFallback(candidate.catalogImports, fallback.catalogImports),
    trustItems: arrayOrFallback(candidate.trustItems, fallback.trustItems),
    benefits: arrayOrFallback(candidate.benefits, fallback.benefits),
    faqs: arrayOrFallback(candidate.faqs, fallback.faqs),
    orders: arrayOrFallback<Order>(candidate.orders, fallback.orders).map((order) => ({
      ...order,
      cashbackTotal: Number(order.cashbackTotal) || 0,
      items: order.items.map((item) => ({ ...item, unitCashback: Number(item.unitCashback) || 0 })),
    })),
    financialTransactions: arrayOrFallback(candidate.financialTransactions, fallback.financialTransactions),
    inventoryMovements: arrayOrFallback(candidate.inventoryMovements, fallback.inventoryMovements),
    productLots: arrayOrFallback(candidate.productLots, fallback.productLots),
    suppliers: arrayOrFallback(candidate.suppliers, fallback.suppliers),
    purchaseOrders: arrayOrFallback(candidate.purchaseOrders, fallback.purchaseOrders),
    savedReports: arrayOrFallback(candidate.savedReports, fallback.savedReports),
    exportRuns: arrayOrFallback(candidate.exportRuns, fallback.exportRuns),
    marketingPublications: arrayOrFallback(candidate.marketingPublications, fallback.marketingPublications),
    marketingPublicationVersions: arrayOrFallback(candidate.marketingPublicationVersions, fallback.marketingPublicationVersions),
    messageAutomations: arrayOrFallback(candidate.messageAutomations, fallback.messageAutomations),
    messageLogs: arrayOrFallback(candidate.messageLogs, fallback.messageLogs),
    automationRuns: arrayOrFallback(candidate.automationRuns, fallback.automationRuns),
    teamMembers: arrayOrFallback(candidate.teamMembers, fallback.teamMembers),
    auditLogs: arrayOrFallback(candidate.auditLogs, fallback.auditLogs),
  };
}

function mergeProducts(
  storedProducts: unknown,
  storefrontProducts: StorefrontProduct[],
): Array<Product | StorefrontProduct> {
  if (!Array.isArray(storedProducts)) return storefrontProducts;
  const storedById = new Map(
    storedProducts
      .filter(isRecord)
      .map((product) => [String(product.id ?? ""), product]),
  );

  return storefrontProducts.map((product) => ({
    ...(storedById.get(product.id) ?? {}),
    ...product,
  })) as Array<Product | StorefrontProduct>;
}

export function mergeStorefrontIntoStoredData(
  stored: unknown,
  storefront: StorefrontData,
): StorefrontData & Partial<StoreData> {
  const base = isRecord(stored) ? stored : {};
  const baseTenant = isRecord(base.tenant) ? base.tenant : {};
  const baseSettings = isRecord(base.settings) ? base.settings : {};

  return {
    ...base,
    ...storefront,
    tenant: { ...baseTenant, ...storefront.tenant },
    settings: { ...baseSettings, ...storefront.settings },
    products: mergeProducts(base.products, storefront.products) as Product[],
  } as StorefrontData & Partial<StoreData>;
}
