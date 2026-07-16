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
  costPrice: number;
  stock: number;
  minStock: number;
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
  assignedTo: string;
  whatsappConsent: boolean;
  emailConsent: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CustomerTaskPriority = "low" | "medium" | "high" | "urgent";
export type CustomerTaskStatus = "open" | "completed" | "cancelled";

export interface CustomerTask {
  id: string;
  customerId: string;
  title: string;
  dueAt: string;
  priority: CustomerTaskPriority;
  status: CustomerTaskStatus;
  assignedTo: string;
  notes: string;
  createdAt: string;
  completedAt: string;
}

export type CustomerContactChannel = "whatsapp" | "phone" | "instagram" | "email" | "other";

export interface CustomerContact {
  id: string;
  customerId: string;
  channel: CustomerContactChannel;
  result: "answered" | "no_answer" | "sale" | "follow_up" | "opt_out";
  summary: string;
  nextStepAt: string;
  actorEmail: string;
  createdAt: string;
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
  unitCost: number;
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

export type FinancialTransactionType = "income" | "expense";
export type FinancialTransactionStatus = "pending" | "paid" | "cancelled";

export interface FinancialTransaction {
  id: string;
  type: FinancialTransactionType;
  status: FinancialTransactionStatus;
  description: string;
  amount: number;
  category: string;
  account: string;
  costCenter: string;
  dueDate: string;
  paidAt: string;
  orderId: string;
  purchaseOrderId: string;
  recurring: boolean;
  notes: string;
  createdAt: string;
}

export type InventoryMovementType = "opening" | "purchase" | "sale" | "return" | "adjustment" | "loss" | "transfer";

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  balanceAfter: number;
  unitCost: number;
  referenceType: string;
  referenceId: string;
  note: string;
  actorEmail: string;
  createdAt: string;
}

export interface ProductLot {
  id: string;
  productId: string;
  code: string;
  expiryDate: string;
  quantity: number;
  status: "available" | "blocked" | "expired";
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  taxId: string;
  email: string;
  phone: string;
  leadTimeDays: number;
  notes: string;
  active: boolean;
  createdAt: string;
}

export interface PurchaseOrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitCost: number;
  lotCode: string;
  expiryDate: string;
}

export type PurchaseOrderStatus = "draft" | "ordered" | "partial" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  expectedAt: string;
  receivedAt: string;
  total: number;
  notes: string;
  items: PurchaseOrderItem[];
  createdAt: string;
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
  | "crm"
  | "customers"
  | "orders"
  | "finance"
  | "inventory"
  | "purchasing"
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
  customerTasks: CustomerTask[];
  customerContacts: CustomerContact[];
  couponRedemptions: CouponRedemption[];
  catalogImports: CatalogImportRun[];
  trustItems: TrustItem[];
  benefits: Benefit[];
  faqs: Faq[];
  orders: Order[];
  financialTransactions: FinancialTransaction[];
  inventoryMovements: InventoryMovement[];
  productLots: ProductLot[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
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
