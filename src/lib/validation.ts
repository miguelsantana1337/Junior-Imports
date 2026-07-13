import { z } from "zod";

const money = z.coerce.number().min(0, "Informe um valor válido.");

export const checkoutSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo."),
  phone: z.string().trim().regex(/^\D*(?:\d\D*){10,11}$/, "Informe um WhatsApp válido."),
  email: z.string().trim().email("Informe um e-mail válido."),
  zip: z.string().trim().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().min(2, "Selecione o estado."),
  address: z.string().trim().min(3, "Informe o endereço."),
  number: z.string().trim().min(1, "Informe o número."),
  complement: z.string().trim().max(120),
  payment: z.enum(["Pix", "Cartao", "Boleto"]),
  consent: z.boolean().refine(Boolean, "Confirme que este pedido é apenas uma simulação."),
});

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome."),
  sku: z.string().trim().min(2, "Informe o SKU."),
  categoryId: z.string().min(1, "Selecione a categoria."),
  brand: z.string().trim().min(2, "Informe a marca."),
  price: money,
  compareAt: money,
  stock: z.coerce.number().int().min(0),
  badge: z.string().trim().max(40),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  description: z.string().trim().min(10, "Descreva o produto."),
  rating: z.coerce.number().min(0).max(5),
  reviews: z.coerce.number().int().min(0),
  imageUrl: z.union([z.literal(""), z.string().url("Use uma URL válida.")]),
  featured: z.boolean(),
  active: z.boolean(),
});

export const bannerSchema = z.object({
  id: z.string().optional(),
  kicker: z.string().trim(),
  title: z.string().trim(),
  highlight: z.string().trim(),
  subtitle: z.string().trim(),
  buttonText: z.string().trim(),
  buttonLink: z.string().trim(),
  startColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  endColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  imageUrl: z.union([z.literal(""), z.string().url("Use uma URL válida.")]),
  imageOnly: z.boolean(),
  active: z.boolean(),
}).superRefine((banner, context) => {
  if (banner.imageOnly && !banner.imageUrl) {
    context.addIssue({ code: "custom", path: ["imageUrl"], message: "Envie uma imagem para o banner somente imagem." });
  }
  if (!banner.imageOnly) {
    if (banner.title.length < 4) context.addIssue({ code: "custom", path: ["title"], message: "Informe o título do banner." });
    if (banner.subtitle.length < 4) context.addIssue({ code: "custom", path: ["subtitle"], message: "Informe o subtítulo do banner." });
    if (banner.buttonText.length < 2) context.addIssue({ code: "custom", path: ["buttonText"], message: "Informe o texto do botão." });
    if (!banner.buttonLink) context.addIssue({ code: "custom", path: ["buttonLink"], message: "Informe o link do botão." });
  }
});

export const categorySchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome da categoria."),
  active: z.boolean(),
});

export const couponSchema = z.object({
  id: z.string().optional(),
  code: z.string().trim().min(3).max(30).transform((value) => value.toUpperCase()),
  type: z.enum(["percent", "fixed"]),
  value: money,
  minimum: money,
  expiresAt: z.string(),
  active: z.boolean(),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2),
  logoUrl: z.union([z.literal(""), z.string().url("Use uma URL válida para a logo.")]),
  faviconUrl: z.union([z.literal(""), z.string().url("Use uma URL válida para o favicon.")]),
  whatsapp: z.string().trim().regex(/^\D*(?:\d\D*){10,13}$/),
  email: z.string().trim().email(),
  hours: z.string().trim().min(3),
  announcement: z.string().trim().min(3),
  footerDescription: z.string().trim().min(3),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  backgroundColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  textColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  fontFamily: z.enum(["Inter", "Manrope", "Poppins", "System"]),
  headerLayout: z.enum(["left", "center"]),
  contentWidth: z.coerce.number().int().min(960).max(1600),
  borderRadius: z.coerce.number().int().min(0).max(40),
  freeShippingThreshold: money,
  shippingFlat: money,
  pixDiscount: z.coerce.number().min(0).max(100),
  autoBannerSeconds: z.coerce.number().int().min(3).max(30),
});

export const storePageSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome da página."),
  slug: z.string().trim().min(2, "Informe o endereço da página.").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use somente letras minúsculas, números e hífens."),
  title: z.string().trim().min(2, "Informe o título da página."),
  description: z.string().trim().max(180, "Use até 180 caracteres."),
  active: z.boolean(),
  showInNavigation: z.boolean(),
  isHome: z.boolean(),
});

export const pageBlockSchema = z.object({
  id: z.string().optional(),
  pageId: z.string().min(1),
  kind: z.enum(["hero", "trust", "featured", "catalog", "promo", "benefits", "faq", "text", "image", "cta", "spacer"]),
  name: z.string().trim().min(2, "Informe um nome interno."),
  eyebrow: z.string().trim().max(80),
  title: z.string().trim().max(160),
  body: z.string().trim().max(1200),
  buttonText: z.string().trim().max(60),
  buttonLink: z.string().trim().max(300),
  imageUrl: z.union([z.literal(""), z.string().url("Use uma URL válida.")]),
  backgroundColor: z.union([z.literal(""), z.string().regex(/^#[0-9a-f]{6}$/i)]),
  textColor: z.union([z.literal(""), z.string().regex(/^#[0-9a-f]{6}$/i)]),
  containerWidth: z.enum(["narrow", "normal", "wide", "full"]),
  padding: z.enum(["none", "small", "medium", "large"]),
  columns: z.coerce.number().int().min(1).max(4),
  active: z.boolean(),
}).superRefine((block, context) => {
  if (block.kind === "image" && !block.imageUrl) context.addIssue({ code: "custom", path: ["imageUrl"], message: "Envie uma imagem para este container." });
  if (["text", "cta"].includes(block.kind) && !block.title) context.addIssue({ code: "custom", path: ["title"], message: "Informe o título do container." });
});

export const messageAutomationSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome da automação."),
  triggerStatus: z.enum(["Novo", "Aguardando pagamento", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"]),
  channel: z.enum(["whatsapp", "email"]),
  subject: z.string().trim().max(140),
  message: z.string().trim().min(10, "Escreva uma mensagem com pelo menos 10 caracteres.").max(1200),
  active: z.boolean(),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type StorePageInput = z.infer<typeof storePageSchema>;
export type PageBlockInput = z.infer<typeof pageBlockSchema>;
export type MessageAutomationInput = z.infer<typeof messageAutomationSchema>;
