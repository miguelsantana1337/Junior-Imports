import "server-only";

import { cloneSeedData } from "@/data/seed";
import type {
  Banner,
  Benefit,
  Category,
  Coupon,
  Faq,
  HomeSection,
  MessageAutomation,
  MessageLog,
  Order,
  PageBlock,
  Product,
  StoreData,
  StorePage,
  StoreSettings,
  TrustItem,
} from "@/types/store";
import { createClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

const num = (value: unknown) => Number(value) || 0;
const str = (value: unknown) => String(value ?? "");

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
  return {
    id: str(row.id),
    slug: str(row.slug),
    name: str(row.name),
    categoryId,
    category: categories.find((item) => item.id === categoryId)?.name ?? "Sem categoria",
    brand: str(row.brand),
    price: num(row.price),
    compareAt: num(row.compare_at),
    stock: num(row.stock),
    badge: str(row.badge),
    accent: str(row.accent) || "#1677ff",
    description: str(row.description),
    sku: str(row.sku),
    rating: num(row.rating),
    reviews: num(row.reviews),
    featured: Boolean(row.featured),
    active: Boolean(row.active),
    order: num(row.order_index),
    imageUrl: str(row.image_url),
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
    expiresAt: str(row.expires_at),
  };
}

function mapSettings(row: Row, fallback: StoreSettings): StoreSettings {
  return {
    storeName: str(row.store_name),
    logoUrl: str(row.logo_url),
    faviconUrl: str(row.favicon_url),
    whatsapp: str(row.whatsapp),
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
    pixDiscount: num(row.pix_discount),
    autoBannerSeconds: num(row.auto_banner_seconds),
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

function mapSimpleOrdered<T extends TrustItem | Benefit | Faq>(row: Row) {
  return { ...row, id: str(row.id), order: num(row.order_index) } as unknown as T;
}

function mapOrder(row: Row): Order {
  const items = Array.isArray(row.order_items) ? row.order_items : [];
  return {
    id: str(row.id),
    code: str(row.code),
    createdAt: str(row.created_at),
    customer: row.customer as Order["customer"],
    items: (items as Row[]).map((item) => ({
      productId: str(item.product_id),
      name: str(item.product_name),
      quantity: num(item.quantity),
      unitPrice: num(item.unit_price),
    })),
    subtotal: num(row.subtotal),
    discount: num(row.discount),
    shipping: num(row.shipping),
    total: num(row.total),
    payment: str(row.payment) as Order["payment"],
    status: str(row.status) as Order["status"],
    couponCode: str(row.coupon_code),
  };
}

export async function getStoreData(options: { admin?: boolean } = {}): Promise<StoreData> {
  const fallback = cloneSeedData();
  const supabase = await createClient();
  if (!supabase) return fallback;

  const queries = await Promise.all([
    supabase.from("store_settings").select("*").eq("id", "default").maybeSingle(),
    supabase.from("categories").select("*").order("order_index"),
    supabase.from("products").select("*").order("order_index"),
    supabase.from("banners").select("*").order("order_index"),
    supabase.from("home_sections").select("*").order("order_index"),
    supabase.from("coupons").select("*").order("code"),
    supabase.from("trust_items").select("*").order("order_index"),
    supabase.from("benefits").select("*").order("order_index"),
    supabase.from("faqs").select("*").order("order_index"),
    options.admin
      ? supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    supabase.from("store_pages").select("*").order("order_index"),
    supabase.from("page_blocks").select("*").order("order_index"),
    options.admin
      ? supabase.from("message_automations").select("*").order("order_index")
      : Promise.resolve({ data: [], error: null }),
    options.admin
      ? supabase.from("message_logs").select("*").order("created_at", { ascending: false }).limit(100)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const categories = queries[1].error
    ? fallback.categories
    : ((queries[1].data ?? []) as Row[]).map(mapCategory);
  return {
    settings: queries[0].data && !queries[0].error ? mapSettings(queries[0].data as Row, fallback.settings) : fallback.settings,
    categories,
    products: queries[2].error ? fallback.products : ((queries[2].data ?? []) as Row[]).map((row) => mapProduct(row, categories)),
    banners: queries[3].error ? fallback.banners : ((queries[3].data ?? []) as Row[]).map(mapBanner),
    sections: queries[4].error ? fallback.sections : ((queries[4].data ?? []) as Row[]).map(mapSection),
    coupons: queries[5].error ? fallback.coupons : ((queries[5].data ?? []) as Row[]).map(mapCoupon),
    trustItems: queries[6].error ? fallback.trustItems : ((queries[6].data ?? []) as Row[]).map((row) => mapSimpleOrdered<TrustItem>(row)),
    benefits: queries[7].error ? fallback.benefits : ((queries[7].data ?? []) as Row[]).map((row) => mapSimpleOrdered<Benefit>(row)),
    faqs: queries[8].error ? fallback.faqs : ((queries[8].data ?? []) as Row[]).map((row) => mapSimpleOrdered<Faq>(row)),
    orders: queries[9].error ? fallback.orders : ((queries[9].data ?? []) as Row[]).map(mapOrder),
    pages: queries[10].error || !queries[10].data?.length ? fallback.pages : (queries[10].data as Row[]).map(mapPage),
    pageBlocks: queries[11].error || !queries[11].data?.length ? fallback.pageBlocks : (queries[11].data as Row[]).map(mapPageBlock),
    messageAutomations: options.admin
      ? (queries[12].error ? fallback.messageAutomations : ((queries[12].data ?? []) as Row[]).map(mapMessageAutomation))
      : [],
    messageLogs: options.admin && !queries[13].error ? ((queries[13].data ?? []) as Row[]).map(mapMessageLog) : [],
  };
}

export async function getProductBySlug(slug: string) {
  const data = await getStoreData();
  return data.products.find((product) => product.slug === slug) ?? null;
}
