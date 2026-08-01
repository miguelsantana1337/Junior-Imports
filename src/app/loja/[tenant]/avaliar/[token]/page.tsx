import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Avaliar Produto", robots: { index: false, follow: false } };
}

export default function ReviewPage() {
  notFound();
}
