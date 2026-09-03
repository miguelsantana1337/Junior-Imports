import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getElectronicsStoreData } from "@/lib/electronics-store-data";
import { electronicsStorefrontUrl, isOfficialElectronicsHost } from "@/lib/storefront-seo";

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  if (!isOfficialElectronicsHost(requestHeaders.get("host"))) return [];

  const data = await getElectronicsStoreData();
  return [
    {
      url: electronicsStorefrontUrl(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...data.products.filter((product) => product.active).map((product) => ({
      url: electronicsStorefrontUrl(`/produtos/${product.slug}`),
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];
}
