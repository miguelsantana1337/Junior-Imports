import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ElectronicsScreen } from "@/components/store/electronics-screen";
import {
  pharmaceuticalScopeHeader,
  storefrontCatalogScopeFromHeader,
} from "@/lib/storefront-catalog-scope";

export const metadata: Metadata = {
  title: "Eletrônicos",
  description: "Vitrine exclusiva de eletrônicos da Junior Imports.",
};

export default async function TenantElectronicsPage() {
  const requestHeaders = await headers();
  if (storefrontCatalogScopeFromHeader(requestHeaders.get(pharmaceuticalScopeHeader)) === "pharmaceutical") {
    redirect("/");
  }
  return <ElectronicsScreen />;
}
