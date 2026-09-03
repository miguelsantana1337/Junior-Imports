import type { Metadata } from "next";
import { headers } from "next/headers";
import { ElectronicsScreen } from "@/components/store/electronics-screen";
import { JsonLd } from "@/components/seo/json-ld";
import { getElectronicsStoreData } from "@/lib/electronics-store-data";
import {
  buildElectronicsWebsiteStructuredData,
  electronicsStorefrontUrl,
  isOfficialElectronicsHost,
  publicElectronicsRobots,
} from "@/lib/storefront-seo";
import { buildStorefrontSocialMetadata, privateCatalogRobots } from "@/lib/storefront-metadata";

const title = "Eletrônicos Apple sob encomenda | Junior Imports";
const description = "Encontre iPhone, iPad, MacBook, Apple Watch, AirPods e acessórios Apple na Junior Imports. Consulte modelos, capacidades e valores e confirme seu pedido pelo WhatsApp.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const indexable = isOfficialElectronicsHost(requestHeaders.get("host"));
  const canonical = electronicsStorefrontUrl();
  return {
    title: { absolute: title },
    description,
    robots: indexable ? publicElectronicsRobots : privateCatalogRobots,
    alternates: { canonical },
    ...buildStorefrontSocialMetadata({
      title,
      description,
      storeName: "Junior Imports",
      url: canonical,
    }),
  };
}

export default async function HomePage() {
  const data = await getElectronicsStoreData();
  return <>
    <JsonLd data={buildElectronicsWebsiteStructuredData({
      storeName: data.settings.storeName,
      logoUrl: data.settings.logoUrl,
      products: data.products,
    })} />
    <ElectronicsScreen />
  </>;
}
