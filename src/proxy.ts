import { NextRequest, NextResponse } from "next/server";
import { platformConfig } from "@/config/platform";
import { getPrimaryStorefrontRedirectPath } from "@/lib/canonical-storefront-path";
import { isPharmaceuticalStorefrontHost, normalizeHostname } from "@/lib/pharmaceutical-storefront-host";
import { pharmaceuticalScopeHeader } from "@/lib/storefront-catalog-scope";
import { storefrontRobotsHeader } from "@/lib/storefront-seo";

const reservedSubdomains = new Set(["www", "app", "admin"]);

function withStorefrontRobotsPolicy(response: NextResponse, hostname: string, pathname: string) {
  const robotsPolicy = storefrontRobotsHeader(hostname, pathname);
  if (robotsPolicy) response.headers.set("X-Robots-Tag", robotsPolicy);
  return response;
}

async function customDomainTenant(hostname: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return "";
  const endpoint = new URL("/rest/v1/tenant_domains", url);
  endpoint.searchParams.set("hostname", `eq.${hostname}`);
  endpoint.searchParams.set("verified", "eq.true");
  endpoint.searchParams.set("select", "tenants!inner(slug,status)");
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  });
  if (!response.ok) return "";
  const rows = await response.json() as Array<{ tenants?: { slug?: string; status?: string } }>;
  const tenant = rows[0]?.tenants;
  return tenant?.status === "suspended" ? "" : tenant?.slug ?? "";
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const hostname = normalizeHostname(request.headers.get("host"));
  const pharmaceuticalStorefront = isPharmaceuticalStorefrontHost(hostname);
  // Scope is derived from the host, never accepted from a client-supplied header.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tenant-domain");
  requestHeaders.set(pharmaceuticalScopeHeader, "all");
  const primaryStorefrontPath = getPrimaryStorefrontRedirectPath(
    pathname,
    platformConfig.clientId,
  );

  if (primaryStorefrontPath) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = primaryStorefrontPath;
    return withStorefrontRobotsPolicy(NextResponse.redirect(canonicalUrl, 308), hostname, pathname);
  }

  if (/^\/(admin|api|saas|loja|_next|mcp|\.well-known)(\/|$)/.test(pathname)) {
    return withStorefrontRobotsPolicy(NextResponse.next({ request: { headers: requestHeaders } }), hostname, pathname);
  }

  if (/\.[a-z0-9]+$/i.test(pathname)) {
    requestHeaders.set(pharmaceuticalScopeHeader, pharmaceuticalStorefront ? "pharmaceutical" : "electronics");
    return withStorefrontRobotsPolicy(NextResponse.next({ request: { headers: requestHeaders } }), hostname, pathname);
  }

  if (pathname === "/eletronicos") {
    const rootUrl = request.nextUrl.clone();
    rootUrl.pathname = "/";
    return withStorefrontRobotsPolicy(NextResponse.redirect(rootUrl, 308), hostname, pathname);
  }

  if (pharmaceuticalStorefront) {
    const url = request.nextUrl.clone();
    url.pathname = `/loja/${platformConfig.clientId}${pathname === "/" ? "" : pathname}`;
    requestHeaders.set("x-tenant-domain", platformConfig.clientId);
    requestHeaders.set(pharmaceuticalScopeHeader, "pharmaceutical");
    return withStorefrontRobotsPolicy(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), hostname, pathname);
  }

  const rootDomain = (process.env.SAAS_ROOT_DOMAIN ?? "").toLowerCase();
  let tenantSlug = "";

  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const subdomain = hostname.slice(0, -(rootDomain.length + 1)).split(".")[0];
    if (subdomain && !reservedSubdomains.has(subdomain)) tenantSlug = subdomain;
  } else if (rootDomain && hostname !== rootDomain && hostname !== `www.${rootDomain}`) {
    tenantSlug = await customDomainTenant(hostname);
  }

  if (!tenantSlug) {
    requestHeaders.set(pharmaceuticalScopeHeader, "electronics");
    return withStorefrontRobotsPolicy(NextResponse.next({ request: { headers: requestHeaders } }), hostname, pathname);
  }
  const url = request.nextUrl.clone();
  url.pathname = `/loja/${tenantSlug}${pathname === "/" ? "" : pathname}`;
  requestHeaders.set("x-tenant-domain", tenantSlug);
  return withStorefrontRobotsPolicy(NextResponse.rewrite(url, { request: { headers: requestHeaders } }), hostname, pathname);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
