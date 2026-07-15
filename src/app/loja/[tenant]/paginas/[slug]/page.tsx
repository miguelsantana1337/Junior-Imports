import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorePageRenderer } from "@/components/store/store-page-renderer";
import { platformConfig } from "@/config/platform";
import { getStoreData } from "@/lib/store-data";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ tenant: string; slug: string }> }): Promise<Metadata> {
  const { tenant, slug } = await params;
  const data = await getStoreData({ tenantSlug: tenant });
  const page = data.pages.find((item) => item.slug === slug && item.active);
  if (!page) return { robots: privateCatalogRobots };

  const description = page.description || data.settings.footerDescription || platformConfig.metadataDescription;
  const title = `${page.title} | ${data.settings.storeName}`;
  return {
    title: { absolute: title },
    description,
    robots: privateCatalogRobots,
    ...buildPrivateCatalogSocialMetadata({
      title,
      description,
      storeName: data.settings.storeName,
      imageUrl: data.settings.logoUrl || platformConfig.socialImageUrl,
    }),
  };
}

export default async function TenantContentPage({ params }: { params: Promise<{ tenant: string; slug: string }> }) {
  const { tenant, slug } = await params;
  const data = await getStoreData({ tenantSlug: tenant });
  const page = data.pages.find((item) => item.slug === slug && item.active);
  if (!page) notFound();
  return <StorePageRenderer pageId={page.id} />;
}
