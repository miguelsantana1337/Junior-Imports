export type PaymentMethod = "Pix" | "Cartao" | "Boleto";

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
  pixDiscount: number;
  autoBannerSeconds: number;
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
  expiresAt: string;
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

export interface StoreData {
  settings: StoreSettings;
  products: Product[];
  categories: Category[];
  banners: Banner[];
  sections: HomeSection[];
  pages: StorePage[];
  pageBlocks: PageBlock[];
  coupons: Coupon[];
  trustItems: TrustItem[];
  benefits: Benefit[];
  faqs: Faq[];
  orders: Order[];
  messageAutomations: MessageAutomation[];
  messageLogs: MessageLog[];
  teamMembers: AdminUser[];
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
