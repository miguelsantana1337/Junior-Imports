import { z } from "zod";

const money = z.coerce.number().min(0, "Informe um valor válido.");

export const checkoutCustomerSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo."),
  phone: z.string().trim().regex(/^\D*(?:\d\D*){10,11}$/, "Informe um WhatsApp válido."),
  email: z.string().trim().email("Informe um e-mail válido."),
  zip: z.string().trim().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido."),
  city: z.string().trim().min(2, "Informe a cidade."),
  state: z.string().trim().min(2, "Selecione o estado."),
  address: z.string().trim().min(3, "Informe o endereço."),
  number: z.string().trim().min(1, "Informe o número."),
  complement: z.string().trim().max(120),
});

export const checkoutSchema = checkoutCustomerSchema.extend({
  payment: z.enum(["Pix", "Cartao", "Boleto"]),
  consent: z.boolean().refine(Boolean, "Confirme que autoriza o envio dos dados para atendimento."),
  termsAccepted: z.boolean().refine(Boolean, "Leia e aceite os termos para concluir o pedido."),
  botField: z.string().max(0, "Solicitação inválida."),
  startedAt: z.coerce.number().int().positive(),
});

export const manualOrderSchema = z.object({
  customerId: z.string(),
  name: z.string().trim().min(3, "Informe o nome completo do cliente."),
  phone: z.string().trim().regex(/^\D*(?:\d\D*){10,13}$/, "Informe um WhatsApp válido."),
  email: z.string().trim().email("Informe um e-mail válido."),
  zip: z.union([z.literal(""), z.string().trim().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido.")]),
  city: z.string().trim().max(100),
  state: z.string().trim().max(2),
  address: z.string().trim().max(160),
  number: z.string().trim().max(30),
  complement: z.string().trim().max(120),
  payment: z.enum(["Pix", "Cartao", "Boleto"]),
  couponCode: z.string().trim().max(30).transform((value) => value.toUpperCase()),
  internalNotes: z.string().trim().max(1000, "Use no máximo 1.000 caracteres."),
  items: z.array(z.object({
    productId: z.string().min(1, "Selecione um produto."),
    quantity: z.coerce.number().int().min(1, "A quantidade deve ser maior que zero.").max(100),
  })).min(1, "Adicione pelo menos um produto.").max(50, "Adicione no máximo 50 produtos."),
}).superRefine((order, context) => {
  const productIds = order.items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    context.addIssue({ code: "custom", path: ["items"], message: "O mesmo produto não pode aparecer duas vezes no pedido." });
  }
});

export const productSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Informe o nome."),
  sku: z.string().trim().min(2, "Informe o SKU."),
  categoryId: z.string().min(1, "Selecione a categoria."),
  brand: z.string().trim().min(2, "Informe a marca."),
  price: money,
  compareAt: money,
  cashback: money,
  costPrice: money,
  stock: z.coerce.number().int().min(0),
  minStock: z.coerce.number().int().min(0),
  badge: z.string().trim().max(40),
  accent: z.string().regex(/^#[0-9a-f]{6}$/i),
  description: z.string().trim().min(10, "Descreva o produto."),
  rating: z.coerce.number().min(0).max(5),
  reviews: z.coerce.number().int().min(0),
  imageUrl: z.string(),
  imageUrls: z.array(z.string().min(1)).max(10, "Adicione no máximo 10 imagens."),
  featured: z.boolean(),
  active: z.boolean(),
  productType: z.enum(["unclassified", "non_medicine", "otc", "prescription", "controlled"]),
  regulatoryStatus: z.enum(["pending", "approved", "blocked"]),
  activeIngredient: z.string().trim().max(160),
  anvisaRegistration: z.string().trim().max(40),
  presentation: z.string().trim().max(180),
  regulatoryWarning: z.string().trim().max(500),
  pharmacistReviewed: z.boolean(),
}).superRefine((product, context) => {
  const isSupportedImage = (value: string) => !value || /^(https?:\/\/|data:image\/|\/)/i.test(value);
  if (!isSupportedImage(product.imageUrl)) context.addIssue({ code: "custom", path: ["imageUrl"], message: "Use uma URL de imagem válida." });
  product.imageUrls.forEach((image, index) => {
    if (!isSupportedImage(image)) context.addIssue({ code: "custom", path: ["imageUrls", index], message: "Use uma URL de imagem válida." });
  });
  if (product.imageUrl && !product.imageUrls.includes(product.imageUrl)) {
    context.addIssue({ code: "custom", path: ["imageUrl"], message: "A capa precisa fazer parte da galeria." });
  }
  if (product.cashback > product.price) {
    context.addIssue({ code: "custom", path: ["cashback"], message: "O cashback não pode ser maior que o preço de venda." });
  }
  if (product.regulatoryStatus === "approved" && product.productType === "unclassified") {
    context.addIssue({ code: "custom", path: ["productType"], message: "Classifique o produto antes de liberá-lo." });
  }
  if (product.regulatoryStatus === "approved" && product.productType === "otc") {
    if (!product.activeIngredient) context.addIssue({ code: "custom", path: ["activeIngredient"], message: "Informe o princípio ativo." });
    if (!product.presentation) context.addIssue({ code: "custom", path: ["presentation"], message: "Informe a apresentação." });
    if (!/^1[0-9.\/-]{8,}$/.test(product.anvisaRegistration)) context.addIssue({ code: "custom", path: ["anvisaRegistration"], message: "Informe o registro Anvisa." });
    if (!product.regulatoryWarning) context.addIssue({ code: "custom", path: ["regulatoryWarning"], message: "Informe a advertência obrigatória." });
    if (!product.pharmacistReviewed) context.addIssue({ code: "custom", path: ["pharmacistReviewed"], message: "Confirme a revisão farmacêutica." });
  }
});

const optionalImageUrl = z.union([z.literal(""), z.string().url("Use uma URL válida.")]);

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
  imageUrl: optionalImageUrl,
  mobileImageUrl: optionalImageUrl,
  altText: z.string().trim().max(140, "Use no máximo 140 caracteres."),
  imageOnly: z.boolean(),
  active: z.boolean(),
}).superRefine((banner, context) => {
  if (banner.imageOnly && !banner.imageUrl) {
    context.addIssue({ code: "custom", path: ["imageUrl"], message: "Envie uma imagem para o banner somente imagem." });
  }
  if ((banner.imageUrl || banner.mobileImageUrl) && banner.altText.length < 4) {
    context.addIssue({ code: "custom", path: ["altText"], message: "Descreva a imagem para acessibilidade." });
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
  startsAt: z.string(),
  expiresAt: z.string(),
  totalUsageLimit: z.coerce.number().int().min(0, "Use zero para ilimitado."),
  perCustomerLimit: z.coerce.number().int().min(0, "Use zero para ilimitado."),
  firstOrderOnly: z.boolean(),
  usageCount: z.coerce.number().int().min(0),
  active: z.boolean(),
}).superRefine((coupon, context) => {
  if (coupon.startsAt && coupon.expiresAt && coupon.startsAt > coupon.expiresAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "A validade deve ser posterior ao início." });
  }
  if (coupon.totalUsageLimit > 0 && coupon.usageCount > coupon.totalUsageLimit) {
    context.addIssue({ code: "custom", path: ["totalUsageLimit"], message: "O limite não pode ser menor que os usos já registrados." });
  }
});

export const customerSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Informe o nome do cliente."),
  email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.")]),
  phone: z.string().trim().refine((value) => !value || /^\D*(?:\d\D*){10,13}$/.test(value), "Informe um WhatsApp válido."),
  city: z.string().trim().max(100),
  state: z.string().trim().max(2),
  source: z.enum(["whatsapp", "instagram", "referral", "other"]),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  notes: z.string().trim().max(2000, "Use no máximo 2.000 caracteres."),
  assignedTo: z.string().trim().max(160),
  whatsappConsent: z.boolean(),
  emailConsent: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).superRefine((customer, context) => {
  if (!customer.email && !customer.phone) {
    context.addIssue({ code: "custom", path: ["email"], message: "Informe o e-mail ou o WhatsApp do cliente." });
  }
});

export const customerTaskSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1, "Selecione o cliente."),
  title: z.string().trim().min(3, "Descreva a tarefa."),
  dueAt: z.string().min(1, "Informe o prazo."),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["open", "completed", "cancelled"]),
  assignedTo: z.string().trim().min(3, "Informe o responsável."),
  notes: z.string().trim().max(1000),
  createdAt: z.string(),
  completedAt: z.string(),
});

export const customerContactSchema = z.object({
  id: z.string().min(1),
  customerId: z.string().min(1, "Selecione o cliente."),
  channel: z.enum(["whatsapp", "phone", "instagram", "email", "other"]),
  result: z.enum(["answered", "no_answer", "sale", "follow_up", "opt_out"]),
  summary: z.string().trim().min(5, "Registre um resumo do contato.").max(1500),
  nextStepAt: z.string(),
  actorEmail: z.string().trim().email(),
  createdAt: z.string(),
});

export const cashbackCampaignSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(3, "Informe o nome da campanha.").max(100),
  description: z.string().trim().max(500),
  status: z.enum(["draft", "active", "paused", "ended"]),
  startsAt: z.string().min(1, "Informe o início da campanha."),
  endsAt: z.string(),
  multiplier: z.coerce.number().min(1, "O multiplicador mínimo é 1x.").max(10),
  fixedBonus: z.coerce.number().min(0).max(10000),
  creditValidDays: z.coerce.number().int().min(1).max(730),
  priority: z.coerce.number().int().min(0).max(1000),
  targetSegments: z.array(z.enum(["new", "active", "recurring", "vip", "at_risk", "inactive"])).max(6),
  productIds: z.array(z.string().min(1)).max(500),
  createdAt: z.string(),
  updatedAt: z.string(),
}).superRefine((campaign, context) => {
  if (campaign.endsAt && new Date(campaign.endsAt).getTime() <= new Date(campaign.startsAt).getTime()) {
    context.addIssue({ code: "custom", path: ["endsAt"], message: "O término deve ser posterior ao início." });
  }
  if (campaign.multiplier === 1 && campaign.fixedBonus === 0) {
    context.addIssue({ code: "custom", path: ["multiplier"], message: "Defina um multiplicador acima de 1x ou um bônus fixo." });
  }
});

export const cashbackAdjustmentSchema = z.object({
  customerId: z.string().min(1, "Cliente inválido."),
  amount: z.coerce.number().min(-100000).max(100000).refine((value) => value !== 0, "Informe um valor diferente de zero."),
  reason: z.string().trim().min(5, "Explique o motivo do ajuste.").max(240),
  validDays: z.coerce.number().int().min(1).max(730),
});

export const financialTransactionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["income", "expense"]),
  status: z.enum(["pending", "paid", "cancelled"]),
  description: z.string().trim().min(3, "Informe a descrição."),
  amount: z.coerce.number().positive("Informe um valor maior que zero."),
  category: z.string().trim().min(2, "Informe a categoria."),
  account: z.string().trim().min(2, "Informe a conta."),
  costCenter: z.string().trim().min(2, "Informe o centro de custo."),
  dueDate: z.string().min(1, "Informe o vencimento."),
  paidAt: z.string(),
  orderId: z.string(),
  purchaseOrderId: z.string(),
  recurring: z.boolean(),
  notes: z.string().trim().max(1000),
  createdAt: z.string(),
});

export const inventoryMovementSchema = z.object({
  productId: z.string().min(1, "Selecione o produto."),
  type: z.enum(["opening", "purchase", "sale", "return", "adjustment", "loss", "transfer"]),
  quantity: z.coerce.number().int().positive("Informe uma quantidade maior que zero."),
  unitCost: money,
  note: z.string().trim().min(3, "Informe o motivo do movimento."),
});

export const supplierSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2, "Informe o fornecedor."),
  taxId: z.string().trim().max(30),
  email: z.union([z.literal(""), z.string().trim().email("Informe um e-mail válido.")]),
  phone: z.string().trim().max(30),
  leadTimeDays: z.coerce.number().int().min(0).max(365),
  notes: z.string().trim().max(1000),
  active: z.boolean(),
  createdAt: z.string(),
});

export const settingsSchema = z.object({
  storeName: z.string().trim().min(2),
  logoUrl: z.union([z.literal(""), z.string().url("Use uma URL válida para a logo.")]),
  faviconUrl: z.union([z.literal(""), z.string().url("Use uma URL válida para o favicon.")]),
  whatsapp: z.string().trim().regex(/^\D*(?:\d\D*){10,13}$/),
  orderPrefix: z.string().trim().min(2).max(5).regex(/^[A-Za-z0-9]+$/).transform((value) => value.toUpperCase()),
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
  freeShippingEnabled: z.boolean(),
  freeShippingBannerEnabled: z.boolean(),
  freeShippingBannerEyebrow: z.string().trim().max(80),
  freeShippingBannerTitle: z.string().trim().min(3).max(160),
  freeShippingBannerSubtitle: z.string().trim().max(240),
  freeShippingBannerButtonText: z.string().trim().min(2).max(60),
  freeShippingBannerButtonLink: z.string().trim().min(1).max(300),
  pixDiscount: z.coerce.number().min(0).max(100),
  autoBannerSeconds: z.coerce.number().int().min(3).max(30),
  checkoutMode: z.enum(["whatsapp", "demo"]),
  whatsappMessage: z.string().trim().min(10).max(2000),
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
  triggerType: z.enum(["order_status", "customer_segment", "cashback_expiring", "schedule"]),
  triggerValue: z.string().trim().min(1, "Configure o evento que inicia a automação."),
  triggerStatus: z.enum(["Novo", "Aguardando pagamento", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"]),
  channel: z.enum(["whatsapp", "email"]),
  subject: z.string().trim().max(140),
  message: z.string().trim().min(10, "Escreva uma mensagem com pelo menos 10 caracteres.").max(1200),
  conditions: z.object({
    minOrderTotal: z.coerce.number().min(0).max(1_000_000),
    orderSource: z.enum(["any", "storefront", "admin", "legacy"]),
    customerSegment: z.enum(["all", "new", "active", "recurring", "vip", "at_risk", "inactive"]),
  }),
  actions: z.object({
    sendMessage: z.boolean(),
    createTask: z.boolean(),
    taskTitle: z.string().trim().max(160),
    addTag: z.string().trim().max(60),
  }),
  status: z.enum(["draft", "active", "paused"]),
  maxRetries: z.coerce.number().int().min(0).max(10),
  retryDelayMinutes: z.coerce.number().int().min(1).max(10_080),
  lastTestedAt: z.string(),
  runCount: z.coerce.number().int().min(0),
  failureCount: z.coerce.number().int().min(0),
  active: z.boolean(),
  order: z.coerce.number().int().min(0),
}).superRefine((automation, context) => {
  if (automation.channel === "email" && !automation.subject) context.addIssue({ code: "custom", path: ["subject"], message: "Informe o assunto do e-mail." });
  if (!automation.actions.sendMessage && !automation.actions.createTask && !automation.actions.addTag) context.addIssue({ code: "custom", path: ["actions"], message: "Selecione pelo menos uma ação." });
  if (automation.actions.createTask && automation.actions.taskTitle.length < 3) context.addIssue({ code: "custom", path: ["actions", "taskTitle"], message: "Informe o título da tarefa." });
});

export const marketingPublicationSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(3, "Informe o nome da publicação.").max(120),
  description: z.string().trim().max(600),
  kind: z.enum(["campaign", "banner", "coupon", "cashback", "message"]),
  entityId: z.string(),
  status: z.enum(["draft", "in_review", "approved", "scheduled", "published", "paused", "archived"]),
  startsAt: z.string().min(1, "Informe o início da campanha."),
  endsAt: z.string(),
  ownerEmail: z.string().trim().email("Informe o responsável."),
  reviewerEmail: z.union([z.literal(""), z.string().trim().email("Informe um revisor válido.")]),
  revision: z.coerce.number().int().min(1),
  notes: z.string().trim().max(1200),
  lastPublishedAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).superRefine((publication, context) => {
  if (publication.endsAt && new Date(publication.endsAt) <= new Date(publication.startsAt)) context.addIssue({ code: "custom", path: ["endsAt"], message: "O término deve ser posterior ao início." });
  if (publication.kind !== "campaign" && !publication.entityId) context.addIssue({ code: "custom", path: ["entityId"], message: "Vincule o conteúdo que será publicado." });
});

const adminRoleSchema = z.enum(["owner", "manager", "editor", "support", "viewer"]);
const adminPermissionSchema = z.enum(["dashboard", "audit", "crm", "customers", "orders", "finance", "inventory", "purchasing", "catalog", "store", "marketing", "settings", "data", "users"]);

export const adminUserCreateSchema = z.object({
  fullName: z.string().trim().min(3, "Informe o nome completo."),
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(12, "A senha temporária deve ter pelo menos 12 caracteres.").max(72),
  role: adminRoleSchema,
  permissions: z.array(adminPermissionSchema).min(1, "Selecione pelo menos uma permissão."),
  active: z.boolean(),
});

export const adminUserUpdateSchema = adminUserCreateSchema.omit({ password: true, email: true }).extend({
  id: z.string().uuid("Usuário inválido."),
});

export const tenantCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use letras minúsculas, números e hífens."),
  whatsapp: z.string().trim().regex(/^\D*(?:\d\D*){10,13}$/),
  email: z.string().trim().email(),
  primaryColor: z.string().regex(/^#[0-9a-f]{6}$/i),
  orderPrefix: z.string().trim().min(2).max(5).regex(/^[A-Za-z0-9]+$/).transform((value) => value.toUpperCase()),
  ownerName: z.string().trim().min(2).max(100),
  ownerEmail: z.string().trim().email(),
  ownerPassword: z.string().min(12).max(72),
});

export const tenantUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["trial", "active", "suspended"]),
  plan: z.enum(["starter", "pro", "scale"]),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

export const passwordRecoveryRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido."),
});

export const passwordRecoveryVerifySchema = passwordRecoveryRequestSchema.extend({
  code: z.string().trim().regex(/^\d{6}$/, "Informe o código de 6 dígitos."),
});

export const adminPasswordChangeSchema = z.object({
  password: z.string()
    .min(12, "A nova senha deve ter pelo menos 12 caracteres.")
    .max(72)
    .regex(/[a-z]/, "Inclua uma letra minúscula.")
    .regex(/[A-Z]/, "Inclua uma letra maiúscula.")
    .regex(/\d/, "Inclua um número.")
    .regex(/[^A-Za-z0-9]/, "Inclua um caractere especial."),
  confirmation: z.string(),
}).superRefine((value, context) => {
  if (value.password !== value.confirmation) {
    context.addIssue({ code: "custom", path: ["confirmation"], message: "As senhas não coincidem." });
  }
});

export const adminUserPasswordResetSchema = adminPasswordChangeSchema.extend({
  id: z.string().uuid("Usuário inválido."),
});

export const adminMfaAuditSchema = z.object({
  action: z.enum(["enroll", "remove"]),
  factorId: z.string().uuid("Autenticador inválido."),
  friendlyName: z.string().trim().min(3).max(50),
});

export type CheckoutFormInput = z.input<typeof checkoutSchema>;
export type CheckoutInput = z.output<typeof checkoutSchema>;
export type ManualOrderInput = z.infer<typeof manualOrderSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type BannerInput = z.infer<typeof bannerSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerTaskInput = z.infer<typeof customerTaskSchema>;
export type CustomerContactInput = z.infer<typeof customerContactSchema>;
export type CashbackCampaignInput = z.infer<typeof cashbackCampaignSchema>;
export type CashbackAdjustmentInput = z.infer<typeof cashbackAdjustmentSchema>;
export type FinancialTransactionInput = z.infer<typeof financialTransactionSchema>;
export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type StorePageInput = z.infer<typeof storePageSchema>;
export type PageBlockInput = z.infer<typeof pageBlockSchema>;
export type MessageAutomationInput = z.infer<typeof messageAutomationSchema>;
export type MarketingPublicationInput = z.infer<typeof marketingPublicationSchema>;
export type AdminUserCreateInput = z.infer<typeof adminUserCreateSchema>;
export type AdminUserUpdateInput = z.infer<typeof adminUserUpdateSchema>;
export type AdminUserPasswordResetInput = z.infer<typeof adminUserPasswordResetSchema>;
export type AdminMfaAuditInput = z.infer<typeof adminMfaAuditSchema>;
