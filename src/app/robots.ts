import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { electronicsStorefrontUrl, isOfficialElectronicsHost } from "@/lib/storefront-seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const officialElectronics = isOfficialElectronicsHost(requestHeaders.get("host"));
  return {
    rules: [
      {
        userAgent: ["WhatsApp", "facebookexternalhit", "Facebot"],
        allow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/mcp", "/.well-known/", "/saas", "/loja/", "/checkout", "/pedidos/"],
      },
    ],
    ...(officialElectronics ? { sitemap: electronicsStorefrontUrl("/sitemap.xml") } : {}),
  };
}
