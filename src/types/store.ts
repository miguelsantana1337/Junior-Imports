export type PaymentMethod = "Pix" | "Cartao" | "Boleto";

export type CheckoutMode = "whatsapp" | "demo";

export type ProductType =
  | "unclassified"
  | "non_medicine"
  | "otc"
  | "prescription"
  | "controlled";

export type RegulatoryStatus = "pending" | "approved" | "blocked";

export interface StoreTenant {
  id: string;
  slug: string;
  name: string;
  status: "trial" | "active" | "suspended";
  plan: "starter" | "pro" | "scale";
  primaryDomain: string;
  storefrontPath: string;
}

export interface SaasTenant extends Omit<StoreTenant, "storefrontPath"> {
  createdAt: string;
}

export type OrderStatus =
  | "Novo"
  | "Aguardando pagamento"
  | "Pago"
  | "Preparando"
  | "Enviado"
  | "Entregue"
  | "Cancelado";

export interface StoreSettings {
  storeName: string;
  logoUrl: string;
  faviconUrl: string;
  whatsapp: string;
  orderPrefix: string;
  email: string;
  hours: string;
  announcement: string;
  footerDescription: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: "Inter" | "Manrope" | "Poppins" | "System";
  headerLayout: "left" | "center";
  contentWidth: number;
  borderRadius: number;
  freeShippingThreshold: number;
  shippingFlat: number;
  freeShippingEnabled: boolean;
  freeShippingBannerEnabled: boolean;
  freeShippingBannerEyebrow: string;
  freeShippingBannerTitle: string;
  freeShippingBannerSubtitle: string;
  freeShippingBannerButtonText: string;
  freeShippingBannerButtonLink: string;
  pixDiscount: number;
  autoBannerSeconds: number;
  checkoutMode: CheckoutMode;
  whatsappMessage: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  categoryId: string;
  category: string;
  brand: string;
  price: number;
  compareAt: number;
  stock: number;
  badge: string;
  accent: string;
  description: string;
  sku: string;
  rating: number;
  reviews: number;
  featured: boolean;
  active: boolean;
  order: number;
  imageUrl: string;
  imageUrls: string[];
  productType: ProductType;
  regulatoryStatus: RegulatoryStatus;
  activeIngredient: string;
  anvisaRegistration: string;
  presentation: string;
  regulatoryWarning: string;
  pharmacistReviewed: boolean;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  order: number;
}

export interface Banner {
  id: string;
  kicker: string;
  title: string;
  highlight: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  startColor: string;
  endColor: string;
  imageUrl: string;
  mobileImageUrl: string;
  altText: string;
  imageOnly: boolean;
  active: boolean;
  order: number;
}

export interface StorePage {
  id: string;
  name: string;
  slug: string;
  title: string;
  description: string;
  active: boolean;
  showInNavigation: boolean;
  isHome: boolean;
  order: number;
}

export type PageBlockKind =
  | "hero"
  | "trust"
  | "featured"
  | "catalog"
  | "promo"
  | "benefits"
  | "faq"
  | "text"
  | "image"
  | "cta"
  | "spacer";

export interface PageBlock {
  id: string;
  pageId: string;
  kind: PageBlockKind;
  name: string;
  eyebrow: string;
  title: string;
  body: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  backgroundColor: string;
  textColor: string;
  containerWidth: "narrow" | "normal" | "wide" | "full";
  padding: "none" | "small" | "medium" | "large";
  columns: number;
  active: boolean;
  order: number;
}

export type HomeSectionKind =
  | "featured"
  | "catalog"
  | "promo"
  | "benefits"
  | "faq";

export interface HomeSection {
  id: string;
  kind: HomeSectionKind;
  name: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonText?: string;
  buttonLink?: string;
  active: boolean;
  order: number;
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minimum: number;
  active: boolean;
  startsAt: string;
  expiresAt: string;
  totalUsageLimit: number;
  perCustomerLimit: number;
  firstOrderOnly: boolean;
  usageCount: number;
}

export type CustomerSource = "whatsapp" | "instagram" | "referral" | "other";

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  source: CustomerSource;
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CustomerSegment = "new" | "active" | "recurring" | "vip" | "at_risk" | "inactive";

export interface CustomerInsight extends Customer {
  segment: CustomerSegment;
  orderCount: number;
  totalSpent: number;
  averageTicket: number;
  firstOrderAt: string;
  lastOrderAt: string;
  averageDaysBetweenOrders: number;
  daysSinceLastOrder: number;
  predictedNextOrderAt: string;
  favoriteProducts: string[];
}

export interface CouponRedemption {
  id: string;
  couponId: string;
  couponCode: string;
  customerId: string;
  orderId: string;
  normalizedEmail: string;
  normalizedPhone: string;
  discount: number;
  status: "used" | "released";
  usedAt: string;
}

export type CatalogImportKind = "products" | "stock";
export type StockImportMode = "replace" | "increment" | "decrement";

export interface CatalogImportRun {
  id: string;
  kind: CatalogImportKind;
  filename: string;
  mode: StockImportMode | "upsert";
  totalRows: number;
  successRows: number;
  errorRows: number;
  createdAt: string;
  actorEmail: string;
}

export interface TrustItem {
  id: string;
  title: string;
  subtitle: string;
  order: number;
}

export interface Benefit {
  id: string;
  title: string;
  text: string;
  order: number;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  order: number;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  email: string;
  zip: string;
  city: string;
  state: string;
  address: string;
  number: string;
  complement: string;
}

export interface Order {
  id: string;
  customerId: string;
  code: string;
  createdAt: string;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  payment: PaymentMethod;
  status: OrderStatus;
  couponCode: string;
  internalNotes: string;
  trackingCode: string;
}

export type MessageChannel = "whatsapp" | "email";

export interface MessageAutomation {
  id: string;
  name: string;
  triggerStatus: OrderStatus;
  channel: MessageChannel;
  subject: string;
  message: string;
  active: boolean;
  order: number;
}

export interface MessageLog {
  id: string;
  orderId: string;
  orderCode: string;
  automationId: string;
  automationName: string;
  channel: MessageChannel;
  recipient: string;
  subject: string;
  message: string;
  status: "simulated" | "queued" | "sent" | "failed";
  createdAt: string;
}

export type AdminRole = "owner" | "manager" | "editor" | "support" | "viewer";

export type AdminPermission =
  | "dashboard"
  | "customers"
  | "orders"
  | "catalog"
  | "store"
  | "marketing"
  | "settings"
  | "data"
  | "users";

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
  createdAt: string;
  lastSignInAt: string;
  isCurrent?: boolean;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: "insert" | "update" | "delete";
  entityType: string;
  entityId: string;
  entityLabel: string;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
  createdAt: string;
}

export interface StoreData {
  tenant: StoreTenant;
  settings: StoreSettings;
  products: Product[];
  categories: Category[];
  banners: Banner[];
  sections: HomeSection[];
  pages: StorePage[];
  pageBlocks: PageBlock[];
  coupons: Coupon[];
  customers: Customer[];
  couponRedemptions: CouponRedemption[];
  catalogImports: CatalogImportRun[];
  trustItems: TrustItem[];
  benefits: Benefit[];
  faqs: Faq[];
  orders: Order[];
  messageAutomations: MessageAutomation[];
  messageLogs: MessageLog[];
  teamMembers: AdminUser[];
  auditLogs: AuditLog[];
}

export interface CartLine {
  productId: string;
  quantity: number;
}

export interface CartCalculation {
  items: number;
  subtotal: number;
  couponDiscount: number;
  paymentDiscount: number;
  discount: number;
  shipping: number;
  total: number;
}
