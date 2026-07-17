function normalizeClientId(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "store-client";
}

function normalizeOrderPrefix(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5) || "LOJA";
}

const clientId = normalizeClientId(
  process.env.NEXT_PUBLIC_CLIENT_ID ?? "junior-imports",
);

const defaultLogoUrl =
  process.env.NEXT_PUBLIC_DEFAULT_LOGO_URL?.trim() || "/admin-brand.png";

const deployedHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  (deployedHost ? `https://${deployedHost}` : "http://localhost:3000");

export const platformConfig = {
  clientId,
  siteUrl,
  storeName: process.env.NEXT_PUBLIC_STORE_NAME?.trim() || "Junior Imports",
  orderPrefix: normalizeOrderPrefix(
    process.env.NEXT_PUBLIC_ORDER_PREFIX ?? "JI",
  ),
  defaultCheckoutMode:
    process.env.NEXT_PUBLIC_DEFAULT_CHECKOUT_MODE === "demo" ? "demo" : "whatsapp",
  defaultLogoUrl,
  defaultFaviconUrl:
    process.env.NEXT_PUBLIC_DEFAULT_FAVICON_URL?.trim() || "/favicon.svg",
  socialImageUrl:
    process.env.NEXT_PUBLIC_SOCIAL_IMAGE_URL?.trim() || defaultLogoUrl,
  demoNotice:
    process.env.NEXT_PUBLIC_DEMO_NOTICE?.trim() ||
    "PROJETO DEMONSTRATIVO · NENHUMA COMPRA OU PAGAMENTO É PROCESSADO DE FORMA REAL",
  metadataDescription:
    process.env.NEXT_PUBLIC_METADATA_DESCRIPTION?.trim() ||
    "Loja da Junior Imports com produtos organizados por categoria, checkout rápido e atendimento pelo WhatsApp.",
  contact: {
    whatsapp:
      process.env.NEXT_PUBLIC_STORE_WHATSAPP?.trim() || "5531999999999",
    email:
      process.env.NEXT_PUBLIC_STORE_EMAIL?.trim() ||
      "contato@juniorimports.com.br",
  },
  theme: {
    primaryColor:
      process.env.NEXT_PUBLIC_PRIMARY_COLOR?.trim() || "#1677ff",
    secondaryColor:
      process.env.NEXT_PUBLIC_SECONDARY_COLOR?.trim() || "#69a8ff",
  },
  demoAdmin: {
    email:
      process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL?.trim() ||
      "admin@juniorimports.demo",
    fullName:
      process.env.NEXT_PUBLIC_DEMO_ADMIN_NAME?.trim() || "Administrador Demo",
  },
} as const;

export const platformRuntimeKeys = {
  adminCookie: `${clientId}-demo-admin`,
  storeData: `${clientId}:store-data:v1`,
  cart: `${clientId}:cart:v1`,
  favorites: `${clientId}:favorites:v1`,
} as const;

export { normalizeClientId, normalizeOrderPrefix };
