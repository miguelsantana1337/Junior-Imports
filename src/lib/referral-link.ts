import { withStorefrontPath } from "@/lib/storefront-path";

export const REFERRAL_QUERY_PARAM = "indicacao";

export function normalizeReferralCode(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24);
}

export function referralCodeFromSearch(search: string) {
  const params = new URLSearchParams(search);
  return normalizeReferralCode(
    params.get(REFERRAL_QUERY_PARAM) || params.get("ref"),
  );
}

export function referralStorageKey(tenantId: string) {
  return `${tenantId}:referral-code:v1`;
}

export function buildReferralShareUrl(
  origin: string,
  storefrontPath: string,
  code: string,
) {
  const path = buildReferralSharePath(storefrontPath, code);
  return path ? new URL(path, origin).toString() : "";
}

export function buildReferralSharePath(storefrontPath: string, code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return "";
  const url = new URL(withStorefrontPath(storefrontPath, "/"), "https://storefront.local");
  url.searchParams.set(REFERRAL_QUERY_PARAM, normalized);
  return `${url.pathname}${url.search}`;
}
