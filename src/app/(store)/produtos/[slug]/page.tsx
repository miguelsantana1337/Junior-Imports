import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { ProductDetail } from "@/components/store/product-detail";
import { JsonLd } from "@/components/seo/json-ld";
import { platformConfig } from "@/config/platform";
import { getElectronicsStoreData } from "@/lib/electronics-store-data";
import {
  buildStorefrontSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";
import {
  buildElectronicsProductStructuredData,
  electronicsStorefrontUrl,
  isOfficialElectronicsHost,
  publicElectronicsRobots,
} from "@/lib/storefront-seo";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getElectronicsStoreData();
  const product = data.products.find((item) => item.slug === slug);
  if (!product) return { title: "Produto", robots: privateCatalogRobots };

  const title = `${product.name} | ${data.settings.storeName}`;
  const description = product.description || platformConfig.metadataDescription;

  const requestHeaders = await headers();
  const indexable = isOfficialElectronicsHost(requestHeaders.get("host"));
  const canonical = electronicsStorefrontUrl(`/produtos/${product.slug}`);
  return {
    title: { absolute: title },
    description,
    robots: indexable ? publicElectronicsRobots : privateCatalogRobots,
    alternates: { canonical },
    ...buildStorefrontSocialMetadata({
      title,
      description,
      storeName: data.settings.storeName,
      imageUrl: product.imageUrl || data.settings.logoUrl || platformConfig.socialImageUrl,
      imageAlt: product.name,
      url: canonical,
    }),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getElectronicsStoreData();
  const product = data.products.find((item) => item.slug === slug);
  if (!product) notFound();
  return <>
    <JsonLd data={buildElectronicsProductStructuredData(product, data.products, data.settings.storeName)} />
    <ProductDetail slug={slug} />
  </>;
}
