import { NextRequest, NextResponse } from "next/server";
import { platformConfig } from "@/config/platform";
import { getPrimaryStorefrontRedirectPath } from "@/lib/canonical-storefront-path";

const reservedSubdomains = new Set(["www", "app", "admin"]);

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
  const primaryStorefrontPath = getPrimaryStorefrontRedirectPath(
    pathname,
    platformConfig.clientId,
  );

  if (primaryStorefrontPath) {
    const canonicalUrl = request.nextUrl.clone();
    canonicalUrl.pathname = primaryStorefrontPath;
    return NextResponse.redirect(canonicalUrl, 308);
  }

  if (pathname.startsWith("/admin") || pathname.startsWith("/api") || pathname.startsWith("/saas") || pathname.startsWith("/loja") || pathname.startsWith("/_next") || /\.[a-z0-9]+$/i.test(pathname)) {
    return NextResponse.next();
  }

  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const rootDomain = (process.env.SAAS_ROOT_DOMAIN ?? "").toLowerCase();
  let tenantSlug = "";

  if (rootDomain && hostname.endsWith(`.${rootDomain}`)) {
    const subdomain = hostname.slice(0, -(rootDomain.length + 1)).split(".")[0];
    if (subdomain && !reservedSubdomains.has(subdomain)) tenantSlug = subdomain;
  } else if (rootDomain && hostname !== rootDomain && hostname !== `www.${rootDomain}`) {
    tenantSlug = await customDomainTenant(hostname);
  }

  if (!tenantSlug) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = `/loja/${tenantSlug}${pathname === "/" ? "" : pathname}`;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-domain", tenantSlug);
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
