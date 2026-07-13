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
  kicker: z.string().trim().min(2),
  title: z.string().trim().min(4),
  highlight: z.string().trim(),
  subtitle: z.string().trim().min(4),
  buttonText: z.string().trim().min(2),
  buttonLink: z.string().trim().min(1),
  startColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  endColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  imageUrl: z.union([z.literal(""), z.string().url("Use uma URL válida.")]),
  active: z.boolean(),
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
  whatsapp: z.string().trim().regex(/^\D*(?:\d\D*){10,13}$/),
  email: z.string().trim().email(),
  hours: z.string().trim().min(3),
  announcement: z.string().trim().min(3),
  footerDescription: z.string().trim().min(3),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  freeShippingThreshold: money,
  shippingFlat: money,
  pixDiscount: z.coerce.number().min(0).max(100),
  autoBannerSeconds: z.coerce.number().int().min(3).max(30),
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
