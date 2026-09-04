import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ElectronicsPolicyPage, type ElectronicsPolicySlug } from "@/components/store/electronics-policy-page";
import { electronicsStorefrontUrl } from "@/lib/storefront-seo";
import { getElectronicsStoreData } from "@/lib/electronics-store-data";

const policies: Record<ElectronicsPolicySlug, { title: string; description: string }> = {
  "termos-de-compra": {
    title: "Termos de compra de eletrônicos",
    description: "Entenda como pedidos, preços, disponibilidade e pagamentos de eletrônicos são confirmados na Junior Imports.",
  },
  entrega: {
    title: "Política de entrega e retirada de eletrônicos",
    description: "Consulte como funcionam frete por cidade, cotação por CEP, retirada agendada e prazo de eletrônicos sob encomenda.",
  },
  "trocas-e-devolucoes": {
    title: "Política de trocas e devoluções de eletrônicos",
    description: "Veja prazos, procedimento de devolução, reembolso, avaria e direitos do consumidor para compras online.",
  },
  privacidade: {
    title: "Política de privacidade da loja de eletrônicos",
    description: "Saiba quais dados são usados para registrar, proteger e acompanhar pedidos de eletrônicos na Junior Imports.",
  },
};

type PolicyPageProps = { params: Promise<{ slug: string }> };

function isPolicySlug(slug: string): slug is ElectronicsPolicySlug {
  return Object.hasOwn(policies, slug);
}

export function generateStaticParams() {
  return Object.keys(policies).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isPolicySlug(slug)) return { robots: { index: false, follow: false } };
  const data = await getElectronicsStoreData();
  const policy = policies[slug];
  const canonical = electronicsStorefrontUrl(`/politicas/${slug}`);
  const title = `${policy.title} | ${data.settings.storeName}`;
  return {
    title: { absolute: title },
    description: policy.description,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: { type: "website", locale: "pt_BR", url: canonical, title, description: policy.description, siteName: data.settings.storeName },
  };
}

export default async function ElectronicsPolicyRoute({ params }: PolicyPageProps) {
  const { slug } = await params;
  if (!isPolicySlug(slug)) notFound();
  return <ElectronicsPolicyPage policy={slug} />;
}
