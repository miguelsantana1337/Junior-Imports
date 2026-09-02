import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { StoreModeNotice } from "@/components/store/store-mode-notice";
import { AppProviders } from "@/components/providers/app-providers";
import { getStoreData } from "@/lib/store-data";
import { scopeStorefrontData } from "@/lib/storefront-catalog-scope";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const data = scopeStorefrontData(await getStoreData(), "electronics");
  return (
    <AppProviders initialData={data} storefrontScope="electronics">
      <StoreModeNotice />
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
      <CartDrawer />
    </AppProviders>
  );
}
