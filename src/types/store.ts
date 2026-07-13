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
  whatsapp: string;
  email: string;
  hours: string;
  announcement: string;
  footerDescription: string;
  primaryColor: string;
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

export interface StoreData {
  settings: StoreSettings;
  products: Product[];
  categories: Category[];
  banners: Banner[];
  sections: HomeSection[];
  coupons: Coupon[];
  trustItems: TrustItem[];
  benefits: Benefit[];
  faqs: Faq[];
  orders: Order[];
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
