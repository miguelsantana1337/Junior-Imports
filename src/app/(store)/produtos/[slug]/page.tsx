import type { Metadata } from "next";
import { ProductDetail } from "@/components/store/product-detail";
import { getProductBySlug } from "@/lib/store-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return product
    ? { title: product.name, description: product.description }
    : { title: "Produto" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ProductDetail slug={slug} />;
}
