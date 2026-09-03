import { platformConfig } from "@/config/platform";
import { defaultPharmaceuticalStorefrontHost } from "@/lib/pharmaceutical-storefront-host";
import { normalizeReferralCode, REFERRAL_QUERY_PARAM } from "@/lib/referral-link";
import { withStorefrontPath } from "@/lib/storefront-path";
import type { StorefrontTenant } from "@/types/store";

export type AdminCatalogDestination = "electronics" | "pharmaceutical";

export function hasSeparateCatalogs(tenant: Pick<StorefrontTenant, "slug">) {
  return tenant.slug === platformConfig.clientId;
}

// Used only by administrative screens, never by storefront navigation.
export function adminCatalogHref(
  tenant: Pick<StorefrontTenant, "slug" | "storefrontPath">,
  catalog: AdminCatalogDestination,
  path = "/",
) {
  if (!hasSeparateCatalogs(tenant)) return withStorefrontPath(tenant.storefrontPath, path);
  const origin = catalog === "pharmaceutical"
    ? `https://${defaultPharmaceuticalStorefrontHost}`
    : "https://juniorimportsoficial.com.br";
  return new URL(path, origin).toString();
}

export function adminReferralHref(
  tenant: Pick<StorefrontTenant, "slug" | "storefrontPath">,
  catalog: AdminCatalogDestination,
  code: string,
) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return "";
  const href = adminCatalogHref(tenant, catalog);
  const url = new URL(href, "https://storefront.local");
  url.searchParams.set(REFERRAL_QUERY_PARAM, normalized);
  return href.startsWith("https://") ? url.toString() : `${url.pathname}${url.search}`;
}
