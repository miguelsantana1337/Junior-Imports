import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ProductDetail } from "@/components/store/product-detail";
import { platformConfig } from "@/config/platform";
import { getStoreData } from "@/lib/store-data";
import {
  pharmaceuticalScopeHeader,
  resolveStorefrontCatalogScope,
  storefrontCatalogScopeFromHeader,
} from "@/lib/storefront-catalog-scope";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ tenant: string; slug: string }> }): Promise<Metadata> {
  const { tenant, slug } = await params;
  const data = await getStoreData({ tenantSlug: tenant });
  const requestHeaders = await headers();
  const scope = storefrontCatalogScopeFromHeader(requestHeaders.get(pharmaceuticalScopeHeader));
  const catalog = resolveStorefrontCatalogScope(data.products, data.categories, scope);
  const product = catalog.products.find((item) => item.slug === slug);
  if (!product) return { title: "Produto", robots: privateCatalogRobots };

  const title = `${product.name} | ${data.settings.storeName}`;
  const description = product.description || platformConfig.metadataDescription;

  return {
    title: { absolute: title },
    description,
    robots: privateCatalogRobots,
    ...buildPrivateCatalogSocialMetadata({
      title,
      description,
      storeName: data.settings.storeName,
      imageUrl: product.imageUrl || data.settings.logoUrl || platformConfig.socialImageUrl,
    }),
  };
}

export default async function TenantProductPage({ params }: { params: Promise<{ tenant: string; slug: string }> }) {
  const { tenant, slug } = await params;
  const data = await getStoreData({ tenantSlug: tenant });
  const requestHeaders = await headers();
  const scope = storefrontCatalogScopeFromHeader(requestHeaders.get(pharmaceuticalScopeHeader));
  const catalog = resolveStorefrontCatalogScope(data.products, data.categories, scope);
  if (!catalog.products.some((product) => product.slug === slug)) notFound();
  return <ProductDetail slug={slug} />;
}
