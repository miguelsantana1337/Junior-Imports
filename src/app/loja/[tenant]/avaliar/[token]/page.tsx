import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/store/review-form";
import { getStoreData } from "@/lib/store-data";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Avaliar Produto", robots: { index: false, follow: false } };
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ tenant: string; token: string }>;
}) {
  const { tenant, token } = await params;
  const data = await getStoreData({ tenantSlug: tenant });
  
  const review = data.productReviews?.find((r) => r.reviewToken === token);
  if (!review) notFound();

  const product = data.products.find((p) => p.id === review.productId);
  if (!product) notFound();

  return <ReviewForm review={review} product={product} tenant={tenant} />;
}
