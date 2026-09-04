import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { StoreModeNotice } from "@/components/store/store-mode-notice";
import { AppProviders } from "@/components/providers/app-providers";
import { getStoreData } from "@/lib/store-data";
import { scopeStorefrontData } from "@/lib/storefront-catalog-scope";
import { Barlow, Barlow_Condensed } from "next/font/google";
import "@/components/store/electronics-sales.css";

const electronicsBodyFont = Barlow({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-electronics-body", display: "swap", preload: false });
const electronicsHeadingFont = Barlow_Condensed({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-electronics-heading", display: "swap", preload: false });

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const data = scopeStorefrontData(await getStoreData(), "electronics");
  return (
    <AppProviders initialData={data} storefrontScope="electronics">
      <div className={`electronics-app-shell ${electronicsBodyFont.variable} ${electronicsHeadingFont.variable}`}>
        <StoreModeNotice />
        <StoreHeader />
        <main>{children}</main>
        <StoreFooter />
        <CartDrawer />
      </div>
    </AppProviders>
  );
}
