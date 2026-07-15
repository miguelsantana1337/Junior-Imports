import type { Metadata } from "next";
import { ProductDetail } from "@/components/store/product-detail";
import { platformConfig } from "@/config/platform";
import { getStoreData } from "@/lib/store-data";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreData();
  const product = data.products.find((item) => item.slug === slug);
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

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
