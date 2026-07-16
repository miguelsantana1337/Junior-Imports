import "server-only";

import { cloneSeedData } from "@/data/seed";
import { isProductVisibleInCatalog } from "@/lib/product-compliance";
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  AuditLog,
  Banner,
  Benefit,
  CatalogImportRun,
  Category,
  Coupon,
  CouponRedemption,
  Customer,
  CustomerContact,
  CustomerTask,
  Faq,
  FinancialTransaction,
  HomeSection,
  InventoryMovement,
  MessageAutomation,
  MessageLog,
  Order,
  PageBlock,
  Product,
  ProductLot,
  PurchaseOrder,
  StoreData,
  StorePage,
  StoreSettings,
  StoreTenant,
  Supplier,
  TrustItem,
} from "@/types/store";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

const num = (value: unknown) => Number(value) || 0;
const str = (value: unknown) => String(value ?? "");
const stringList = (value: unknown) => Array.isArray(value) ? value.map(str).filter(Boolean) : [];

function mapCategory(row: Row): Category {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    active: Boolean(row.active),
    order: num(row.order_index),
  };
}

function mapProduct(row: Row, categories: Category[]): Product {
  const categoryId = str(row.category_id);
  const imageUrl = str(row.image_url);
  const imageUrls = [...new Set([...stringList(row.image_urls), imageUrl].filter(Boolean))];
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    categoryId,
    category: categories.find((item) => item.id === categoryId)?.name ?? "Sem categoria",
    brand: str(row.brand),
    price: num(row.price),
    compareAt: num(row.compare_at),
    costPrice: num(row.cost_price),
    stock: num(row.stock),
    minStock: num(row.min_stock),
    badge: str(row.badge),
    accent: str(row.accent) || "#1677ff",
    description: str(row.description),
    sku: str(row.sku),
    rating: num(row.rating),
    reviews: num(row.reviews),
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    order: num(row.order_index),
    imageUrl,
    imageUrls,
    productType: (str(row.product_type) || "unclassified") as Product["productType"],
    regulatoryStatus: (str(row.regulatory_status) || "pending") as Product["regulatoryStatus"],
    activeIngredient: str(row.active_ingredient),
    anvisaRegistration: str(row.anvisa_registration),
    presentation: str(row.presentation),
    regulatoryWarning: str(row.regulatory_warning),
    pharmacistReviewed: Boolean(row.pharmacist_reviewed),
  };
}

function mapBanner(row: Row): Banner {
  return {
    id: str(row.id),
    kicker: str(row.kicker),
    title: str(row.title),
    highlight: str(row.highlight),
    subtitle: str(row.subtitle),
    buttonText: str(row.button_text),
    buttonLink: str(row.button_link),
    startColor: str(row.start_color),
    endColor: str(row.end_color),
    imageUrl: str(row.image_url),
    mobileImageUrl: str(row.mobile_image_url),
    altText: str(row.alt_text) || str(row.title),
    imageOnly: Boolean(row.image_only),
    active: Boolean(row.active),
    order: num(row.order_index),
  };
}

function mapPage(row: Row): StorePage {
  return {
    id: str(row.id),
    name: str(row.name),
    slug: str(row.slug),
    title: str(row.title),
    description: str(row.description),
    active: Boolean(row.active),
    showInNavigation: Boolean(row.show_in_navigation),
    isHome: Boolean(row.is_home),
    order: num(row.order_index),
  };
}

function mapPageBlock(row: Row): PageBlock {
  return {
    id: str(row.id),
    pageId: str(row.page_id),
    kind: str(row.kind) as PageBlock["kind"],
    name: str(row.name),
    eyebrow: str(row.eyebrow),
    title: str(row.title),
    body: str(row.body),
    buttonText: str(row.button_text),
    buttonLink: str(row.button_link),
    imageUrl: str(row.image_url),
    backgroundColor: str(row.background_color),
    textColor: str(row.text_color),
    containerWidth: str(row.container_width) as PageBlock["containerWidth"],
    padding: str(row.padding_size) as PageBlock["padding"],
    columns: num(row.columns_count) || 1,
    active: Boolean(row.active),
    order: num(row.order_index),
  };
}

function mapSection(row: Row): HomeSection {
  return {
    id: str(row.id),
    kind: str(row.kind) as HomeSection["kind"],
    name: str(row.name),
    eyebrow: str(row.eyebrow),
    title: str(row.title),
    subtitle: str(row.subtitle),
    buttonText: str(row.button_text),
    buttonLink: str(row.button_link),
    active: Boolean(row.active),
    order: num(row.order_index),
  };
}

function mapCoupon(row: Row): Coupon {
  return {
    id: str(row.id),
    code: str(row.code),
    type: str(row.discount_type) as Coupon["type"],
    value: num(row.value),
    minimum: num(row.minimum),
    active: Boolean(row.active),
    startsAt: str(row.starts_at),
    expiresAt: str(row.expires_at),
    totalUsageLimit: num(row.total_usage_limit),
    perCustomerLimit: num(row.per_customer_limit),
    firstOrderOnly: Boolean(row.first_order_only),
    usageCount: num(row.usage_count),
  };
}

function mapCustomer(row: Row): Customer {
  return {
    id: str(row.id),
    name: str(row.name),
    email: str(row.email),
    phone: str(row.phone),
    city: str(row.city),
    state: str(row.state),
    source: (str(row.source) || "other") as Customer["source"],
    tags: stringList(row.tags),
    notes: str(row.notes),
    assignedTo: str(row.assigned_to),
    whatsappConsent: Boolean(row.whatsapp_consent),
    emailConsent: Boolean(row.email_consent),
    createdAt: str(row.created_at),
    updatedAt: str(row.updated_at),
  };
}

function mapCustomerTask(row: Row): CustomerTask {
  return {
    id: str(row.id),
    customerId: str(row.customer_id),
    title: str(row.title),
    dueAt: str(row.due_at),
    priority: (str(row.priority) || "medium") as CustomerTask["priority"],
    status: (str(row.status) || "open") as CustomerTask["status"],
    assignedTo: str(row.assigned_to),
    notes: str(row.notes),
    createdAt: str(row.created_at),
    completedAt: str(row.completed_at),
  };
}

function mapCustomerContact(row: Row): CustomerContact {
  return {
    id: str(row.id),
    customerId: str(row.customer_id),
    channel: (str(row.channel) || "other") as CustomerContact["channel"],
    result: (str(row.result) || "answered") as CustomerContact["result"],
    summary: str(row.summary),
    nextStepAt: str(row.next_step_at),
    actorEmail: str(row.actor_email),
    createdAt: str(row.created_at),
  };
}

function mapFinancialTransaction(row: Row): FinancialTransaction {
  return {
    id: str(row.id),
    type: str(row.type) as FinancialTransaction["type"],
    status: str(row.status) as FinancialTransaction["status"],
    description: str(row.description),
    amount: num(row.amount),
    category: str(row.category),
    account: str(row.account),
    costCenter: str(row.cost_center),
    dueDate: str(row.due_date),
    paidAt: str(row.paid_at),
    orderId: str(row.order_id),
    purchaseOrderId: str(row.purchase_order_id),
    recurring: Boolean(row.recurring),
    notes: str(row.notes),
    createdAt: str(row.created_at),
  };
}

function mapInventoryMovement(row: Row): InventoryMovement {
  return {
    id: str(row.id),
    productId: str(row.product_id),
    type: str(row.type) as InventoryMovement["type"],
    quantity: num(row.quantity),
    balanceAfter: num(row.balance_after),
    unitCost: num(row.unit_cost),
    referenceType: str(row.reference_type),
    referenceId: str(row.reference_id),
    note: str(row.note),
    actorEmail: str(row.actor_email),
    createdAt: str(row.created_at),
  };
}

function mapProductLot(row: Row): ProductLot {
  return {
    id: str(row.id),
    productId: str(row.product_id),
    code: str(row.code),
    expiryDate: str(row.expiry_date),
    quantity: num(row.quantity),
    status: (str(row.status) || "available") as ProductLot["status"],
    createdAt: str(row.created_at),
  };
}

function mapSupplier(row: Row): Supplier {
  return {
    id: str(row.id),
    name: str(row.name),
    taxId: str(row.tax_id),
    email: str(row.email),
    phone: str(row.phone),
    leadTimeDays: num(row.lead_time_days),
    notes: str(row.notes),
    active: Boolean(row.active),
    createdAt: str(row.created_at),
  };
}

function mapPurchaseOrder(row: Row): PurchaseOrder {
  const items = Array.isArray(row.purchase_order_items) ? row.purchase_order_items as Row[] : [];
  return {
    id: str(row.id),
    code: str(row.code),
    supplierId: str(row.supplier_id),
    status: str(row.status) as PurchaseOrder["status"],
    expectedAt: str(row.expected_at),
    receivedAt: str(row.received_at),
    total: num(row.total),
    notes: str(row.notes),
    items: items.map((item) => ({ id: str(item.id), productId: str(item.product_id), name: str(item.product_name), quantity: num(item.quantity), unitCost: num(item.unit_cost), lotCode: str(item.lot_code), expiryDate: str(item.expiry_date) })),
    createdAt: str(row.created_at),
  };
}

function mapCouponRedemption(row: Row): CouponRedemption {
  return {
    id: str(row.id),
    couponId: str(row.coupon_id),
    couponCode: str(row.coupon_code),
    customerId: str(row.customer_id),
    orderId: str(row.order_id),
    normalizedEmail: str(row.normalized_email),
    normalizedPhone: str(row.normalized_phone),
    discount: num(row.discount),
    status: str(row.status) as CouponRedemption["status"],
    usedAt: str(row.used_at),
  };
}

function mapCatalogImport(row: Row): CatalogImportRun {
  return {
    id: str(row.id),
    kind: str(row.kind) as CatalogImportRun["kind"],
    filename: str(row.filename),
    mode: str(row.mode) as CatalogImportRun["mode"],
    totalRows: num(row.total_rows),
    successRows: num(row.success_rows),
    errorRows: num(row.error_rows),
    createdAt: str(row.created_at),
    actorEmail: str(row.actor_email),
  };
}

function mapSettings(row: Row, fallback: StoreSettings): StoreSettings {
  return {
    storeName: str(row.store_name),
    logoUrl: str(row.logo_url),
    faviconUrl: str(row.favicon_url),
    whatsapp: str(row.whatsapp),
    orderPrefix: str(row.order_prefix) || fallback.orderPrefix,
    email: str(row.email),
    hours: str(row.hours),
    announcement: str(row.announcement),
    footerDescription: str(row.footer_description),
    primaryColor: str(row.primary_color),
    secondaryColor: str(row.secondary_color) || fallback.secondaryColor,
    backgroundColor: str(row.background_color) || fallback.backgroundColor,
    textColor: str(row.text_color) || fallback.textColor,
    fontFamily: (str(row.font_family) || fallback.fontFamily) as StoreSettings["fontFamily"],
    headerLayout: (str(row.header_layout) || fallback.headerLayout) as StoreSettings["headerLayout"],
    contentWidth: num(row.content_width) || fallback.contentWidth,
    borderRadius: row.border_radius === undefined ? fallback.borderRadius : num(row.border_radius),
    freeShippingThreshold: num(row.free_shipping_threshold),
    shippingFlat: num(row.shipping_flat),
    freeShippingEnabled: row.free_shipping_enabled === undefined ? fallback.freeShippingEnabled : Boolean(row.free_shipping_enabled),
    freeShippingBannerEnabled: row.free_shipping_banner_enabled === undefined ? fallback.freeShippingBannerEnabled : Boolean(row.free_shipping_banner_enabled),
    freeShippingBannerEyebrow: str(row.free_shipping_banner_eyebrow) || fallback.freeShippingBannerEyebrow,
    freeShippingBannerTitle: str(row.free_shipping_banner_title) || fallback.freeShippingBannerTitle,
    freeShippingBannerSubtitle: str(row.free_shipping_banner_subtitle) || fallback.freeShippingBannerSubtitle,
    freeShippingBannerButtonText: str(row.free_shipping_banner_button_text) || fallback.freeShippingBannerButtonText,
    freeShippingBannerButtonLink: str(row.free_shipping_banner_button_link) || fallback.freeShippingBannerButtonLink,
    pixDiscount: num(row.pix_discount),
    autoBannerSeconds: num(row.auto_banner_seconds),
    checkoutMode: (str(row.checkout_mode) || fallback.checkoutMode) as StoreSettings["checkoutMode"],
    whatsappMessage: str(row.whatsapp_message) || fallback.whatsappMessage,
  };
}

function mapTenant(row: Row, storefrontPath: string): StoreTenant {
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    status: str(row.status) as StoreTenant["status"],
    plan: str(row.plan) as StoreTenant["plan"],
    primaryDomain: str(row.primary_domain),
    storefrontPath,
  };
}

function mapMessageAutomation(row: Row): MessageAutomation {
  return {
    id: str(row.id),
    name: str(row.name),
    triggerStatus: str(row.trigger_status) as MessageAutomation["triggerStatus"],
    channel: str(row.channel) as MessageAutomation["channel"],
    subject: str(row.subject),
    message: str(row.message),
    active: Boolean(row.active),
    order: num(row.order_index),
  };
}

function mapMessageLog(row: Row): MessageLog {
  return {
    id: str(row.id),
    orderId: str(row.order_id),
    orderCode: str(row.order_code),
    automationId: str(row.automation_id),
    automationName: str(row.automation_name),
    channel: str(row.channel) as MessageLog["channel"],
    recipient: str(row.recipient),
    subject: str(row.subject),
    message: str(row.message),
    status: str(row.status) as MessageLog["status"],
    createdAt: str(row.created_at),
  };
}

function mapAdminUser(row: Row): AdminUser {
  return {
    id: str(row.id),
    fullName: str(row.full_name) || str(row.email).split("@")[0] || "Usuário",
    email: str(row.email),
    role: str(row.role) as AdminRole,
    permissions: (Array.isArray(row.permissions) ? row.permissions : []) as AdminPermission[],
    active: Boolean(row.active),
    createdAt: str(row.created_at),
    lastSignInAt: "",
  };
}

function mapAuditLog(row: Row): AuditLog {
  return {
    id: str(row.id),
    actorId: str(row.actor_id),
    actorEmail: str(row.actor_email),
    action: str(row.action) as AuditLog["action"],
    entityType: str(row.entity_type),
    entityId: str(row.entity_id),
    entityLabel: str(row.entity_label),
    beforeData: row.before_data && typeof row.before_data === "object" ? row.before_data as Record<string, unknown> : null,
    afterData: row.after_data && typeof row.after_data === "object" ? row.after_data as Record<string, unknown> : null,
    createdAt: str(row.created_at),
  };
}

function mapSimpleOrdered<T extends TrustItem | Benefit | Faq>(row: Row) {
  return { ...row, id: str(row.id), order: num(row.order_index) } as unknown as T;
}

function mapOrder(row: Row): Order {
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: str(row.id),
    customerId: str(row.customer_id),
    code: str(row.code),
    createdAt: str(row.created_at),
    customer: row.customer as Order["customer"],
    items: (items as Row[]).map((item) => ({
      productId: str(item.product_id),
      name: str(item.product_name),
      quantity: num(item.quantity),
      unitPrice: num(item.unit_price),
      unitCost: num(item.unit_cost),
    })),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    shipping: num(row.shipping),
    total: num(row.total),
    payment: str(row.payment) as Order["payment"],
    status: str(row.status) as Order["status"],
    couponCode: str(row.coupon_code),
    internalNotes: str(row.internal_notes),
    trackingCode: str(row.tracking_code),
  };
}

type TenantResolution = { tenant: StoreTenant; persisted: boolean };

async function resolveTenant(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  fallback: StoreData,
  tenantSlug?: string,
  storefrontPath?: string,
): Promise<TenantResolution> {
  const requestedSlug = tenantSlug?.trim() || fallback.tenant.slug;
  const publicPath = storefrontPath ?? (tenantSlug ? `/loja/${requestedSlug}` : "");
  const { data, error } = await supabase
    .from("tenants")
    .select("id, slug, name, status, plan, primary_domain")
    .eq("slug", requestedSlug)
    .maybeSingle();

  if (error || !data) {
    return {
      tenant: {
        ...fallback.tenant,
        storefrontPath: publicPath,
      },
      persisted: false,
    };
  }

  return {
    tenant: mapTenant(data as Row, publicPath),
    persisted: true,
  };
}

function scopeTenant<T extends { eq(column: string, value: string): T }>(query: T, tenantId: string | null): T {
  return tenantId ? query.eq("tenant_id", tenantId) : query;
}

export async function getTenantBySlug(slug: string): Promise<StoreTenant | null> {
  const fallback = cloneSeedData();
  if (!slug.trim()) return null;
  const supabase = await createClient();
  if (!supabase) {
    return slug === fallback.tenant.slug
      ? { ...fallback.tenant, storefrontPath: `/loja/${slug}` }
      : null;
  }
  const resolution = await resolveTenant(supabase, fallback, slug);
  if (!resolution.persisted && slug !== fallback.tenant.slug) return null;
  return resolution.tenant;
}

export async function getStoreData(options: { admin?: boolean; tenantSlug?: string; storefrontPath?: string } = {}): Promise<StoreData> {
  const fallback = cloneSeedData();
  const supabase = await createClient();
  if (!supabase) {
    return {
      ...fallback,
      products: options.admin ? fallback.products : fallback.products.filter(isProductVisibleInCatalog),
      tenant: {
        ...fallback.tenant,
        storefrontPath: options.storefrontPath ?? (options.tenantSlug ? `/loja/${fallback.tenant.slug}` : ""),
      },
    };
  }

  const resolution = await resolveTenant(supabase, fallback, options.tenantSlug, options.storefrontPath);
  const tenantId = resolution.persisted ? resolution.tenant.id : null;

  const queries = await Promise.all([
    // @ts-expect-error Supabase's chained generic exceeds TypeScript's instantiation depth after tenant scoping.
    scopeTenant(supabase.from("store_settings").select("*"), tenantId).eq("id", "default").maybeSingle(),
    scopeTenant(supabase.from("categories").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("products").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("banners").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("home_sections").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("coupons").select("*"), tenantId).order("code"),
    scopeTenant(supabase.from("trust_items").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("benefits").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("faqs").select("*"), tenantId).order("order_index"),
    options.admin
      ? scopeTenant(supabase.from("orders").select("*, order_items(*)"), tenantId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    scopeTenant(supabase.from("store_pages").select("*"), tenantId).order("order_index"),
    scopeTenant(supabase.from("page_blocks").select("*"), tenantId).order("order_index"),
    options.admin
      ? scopeTenant(supabase.from("message_automations").select("*"), tenantId).order("order_index")
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("message_logs").select("*"), tenantId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    options.admin && !tenantId
      ? supabase.from("profiles").select("id, full_name, email, role, permissions, active, created_at").order("created_at")
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("audit_logs").select("*"), tenantId).order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("customers").select("*"), tenantId).order("updated_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("coupon_redemptions").select("*"), tenantId).order("used_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("catalog_imports").select("*"), tenantId).order("created_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("customer_tasks").select("*"), tenantId).order("due_at", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("customer_contacts").select("*"), tenantId).order("created_at", { ascending: false }).limit(300)
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("financial_transactions").select("*"), tenantId).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("inventory_movements").select("*"), tenantId).order("created_at", { ascending: false }).limit(500)
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("product_lots").select("*"), tenantId).order("expiry_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("suppliers").select("*"), tenantId).order("name")
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? scopeTenant(supabase.from("purchase_orders").select("*, purchase_order_items(*)"), tenantId).order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (resolution.persisted) {
    const publicNames = ["configurações", "categorias", "produtos", "banners", "seções", "cupons", "itens de confiança", "benefícios", "perguntas", "pedidos", "páginas", "containers"];
    const publicFailures = queries.slice(0, publicNames.length)
      .map((query, index) => query.error ? publicNames[index] : null)
      .filter((name): name is string => Boolean(name));
    if (!queries[0].data) publicFailures.unshift("configurações");
    if (publicFailures.length) {
      throw new Error(`Não foi possível carregar a loja: ${[...new Set(publicFailures)].join(", ")}.`);
    }
  }

  if (options.admin) {
    const requiredNames = ["configurações", "categorias", "produtos", "banners", "seções", "cupons", "itens de confiança", "benefícios", "perguntas", "pedidos", "páginas", "containers", "automações", "mensagens", "usuários"];
    const failures = queries.slice(0, requiredNames.length)
      .map((query, index) => query.error ? requiredNames[index] : null)
      .filter((name): name is string => Boolean(name));
    if (failures.length) {
      throw new Error(`Não foi possível carregar dados administrativos: ${failures.join(", ")}.`);
    }
  }

  const categories = queries[1].error
    ? fallback.categories
    : ((queries[1].data ?? []) as Row[]).map(mapCategory);
  const mappedProducts = queries[2].error
    ? fallback.products
    : ((queries[2].data ?? []) as Row[]).map((row) => mapProduct(row, categories));
  const couponRedemptions = options.admin && !queries[17].error
    ? ((queries[17].data ?? []) as Row[]).map(mapCouponRedemption)
    : [];
  const coupons = (queries[5].error ? fallback.coupons : ((queries[5].data ?? []) as Row[]).map(mapCoupon))
    .map((coupon) => ({
      ...coupon,
      usageCount: couponRedemptions.filter((redemption) => redemption.couponId === coupon.id && redemption.status === "used").length,
    }));

  return {
    tenant: resolution.tenant,
    settings: queries[0].data && !queries[0].error ? mapSettings(queries[0].data as Row, fallback.settings) : fallback.settings,
    categories,
    products: options.admin ? mappedProducts : mappedProducts.filter(isProductVisibleInCatalog),
    banners: queries[3].error ? fallback.banners : ((queries[3].data ?? []) as Row[]).map(mapBanner),
    sections: queries[4].error ? fallback.sections : ((queries[4].data ?? []) as Row[]).map(mapSection),
    coupons,
    customers: options.admin && !queries[16].error ? ((queries[16].data ?? []) as Row[]).map(mapCustomer) : [],
    customerTasks: options.admin && !queries[19].error ? ((queries[19].data ?? []) as Row[]).map(mapCustomerTask) : fallback.customerTasks,
    customerContacts: options.admin && !queries[20].error ? ((queries[20].data ?? []) as Row[]).map(mapCustomerContact) : fallback.customerContacts,
    couponRedemptions,
    catalogImports: options.admin && !queries[18].error ? ((queries[18].data ?? []) as Row[]).map(mapCatalogImport) : [],
    trustItems: queries[6].error ? fallback.trustItems : ((queries[6].data ?? []) as Row[]).map((row) => mapSimpleOrdered<TrustItem>(row)),
    benefits: queries[7].error ? fallback.benefits : ((queries[7].data ?? []) as Row[]).map((row) => mapSimpleOrdered<Benefit>(row)),
    faqs: queries[8].error ? fallback.faqs : ((queries[8].data ?? []) as Row[]).map((row) => mapSimpleOrdered<Faq>(row)),
    orders: queries[9].error ? fallback.orders : ((queries[9].data ?? []) as Row[]).map(mapOrder),
    financialTransactions: options.admin && !queries[21].error ? ((queries[21].data ?? []) as Row[]).map(mapFinancialTransaction) : fallback.financialTransactions,
    inventoryMovements: options.admin && !queries[22].error ? ((queries[22].data ?? []) as Row[]).map(mapInventoryMovement) : fallback.inventoryMovements,
    productLots: options.admin && !queries[23].error ? ((queries[23].data ?? []) as Row[]).map(mapProductLot) : fallback.productLots,
    suppliers: options.admin && !queries[24].error ? ((queries[24].data ?? []) as Row[]).map(mapSupplier) : fallback.suppliers,
    purchaseOrders: options.admin && !queries[25].error ? ((queries[25].data ?? []) as Row[]).map(mapPurchaseOrder) : fallback.purchaseOrders,
    pages: queries[10].error || (!resolution.persisted && !queries[10].data?.length) ? fallback.pages : ((queries[10].data ?? []) as Row[]).map(mapPage),
    pageBlocks: queries[11].error || (!resolution.persisted && !queries[11].data?.length) ? fallback.pageBlocks : ((queries[11].data ?? []) as Row[]).map(mapPageBlock),
    messageAutomations: options.admin
      ? (queries[12].error ? fallback.messageAutomations : ((queries[12].data ?? []) as Row[]).map(mapMessageAutomation))
      : [],
    messageLogs: options.admin && !queries[13].error ? ((queries[13].data ?? []) as Row[]).map(mapMessageLog) : [],
    teamMembers: options.admin && !queries[14].error ? ((queries[14].data ?? []) as Row[]).map(mapAdminUser) : [],
    auditLogs: options.admin && !queries[15].error ? ((queries[15].data ?? []) as Row[]).map(mapAuditLog) : [],
  };
}

export async function getProductBySlug(slug: string) {
  const data = await getStoreData();
  return data.products.find((product) => product.slug === slug) ?? null;
}
