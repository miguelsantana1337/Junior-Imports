import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StorePageRenderer } from "@/components/store/store-page-renderer";
import { getStoreData } from "@/lib/store-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStoreData();
  const page = data.pages.find((item) => item.slug === slug && item.active && !item.isHome);
  if (!page) return {};
  return { title: page.title, description: page.description };
}

export default async function CustomStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getStoreData();
  const page = data.pages.find((item) => item.slug === slug && item.active && !item.isHome);
  if (!page) notFound();
  return <StorePageRenderer pageId={page.id} />;
}
