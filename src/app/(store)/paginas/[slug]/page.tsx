import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorePageRenderer } from "@/components/store/store-page-renderer";
import { platformConfig } from "@/config/platform";
import { getStoreData } from "@/lib/store-data";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreData();
  const page = data.pages.find((item) => item.slug === slug && item.active && !item.isHome);
  if (!page) return {};
  const description = page.description || data.settings.footerDescription || platformConfig.metadataDescription;
  const socialTitle = `${page.title} | ${data.settings.storeName}`;
  return {
    title: page.title,
    description,
    robots: privateCatalogRobots,
    ...buildPrivateCatalogSocialMetadata({
      title: socialTitle,
      description,
      storeName: data.settings.storeName,
      imageUrl: data.settings.logoUrl || platformConfig.socialImageUrl,
    }),
  };
}

export default async function CustomStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStoreData();
  const page = data.pages.find((item) => item.slug === slug && item.active && !item.isHome);
  if (!page) notFound();
  return <StorePageRenderer pageId={page.id} />;
}
