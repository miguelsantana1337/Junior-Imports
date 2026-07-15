import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";
import { StoreModeNotice } from "@/components/store/store-mode-notice";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StoreModeNotice />
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
      <CartDrawer />
    </>
  );
}
