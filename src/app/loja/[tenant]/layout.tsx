import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { AppProviders } from "@/components/providers/app-providers";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { StoreFooter } from "@/components/store/store-footer";
import { StoreHeader } from "@/components/store/store-header";
import { StoreModeNotice } from "@/components/store/store-mode-notice";
import { platformConfig } from "@/config/platform";
import { getStoreData, getTenantBySlug } from "@/lib/store-data";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";

export async function generateMetadata({ params }: { params: Promise<{ tenant: string }> }): Promise<Metadata> {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { title: "Loja não encontrada" };
  const data = await getStoreData({ tenantSlug: slug });
  const title = `${data.settings.storeName} | Catálogo privado`;
  const description = data.settings.footerDescription || platformConfig.metadataDescription;

  return {
    title: { absolute: title },
    description,
    robots: privateCatalogRobots,
    ...buildPrivateCatalogSocialMetadata({
      title,
      description,
      storeName: data.settings.storeName,
      imageUrl: data.settings.logoUrl || platformConfig.socialImageUrl,
    }),
  };
}

export default async function TenantStoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ tenant: string }> }) {
  const { tenant: slug } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant || tenant.status === "suspended") notFound();
  const requestHeaders = await headers();
  const customDomain = requestHeaders.get("x-tenant-domain") === slug;
  const data = await getStoreData({ tenantSlug: slug, storefrontPath: customDomain ? "" : `/loja/${slug}` });

  return (
    <AppProviders initialData={data}>
      <StoreModeNotice />
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
      <CartDrawer />
    </AppProviders>
  );
}
