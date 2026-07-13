import { StoreHeader } from "@/components/store/store-header";
import { StoreFooter } from "@/components/store/store-footer";
import { CartDrawer } from "@/components/cart/cart-drawer";

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="demo-notice">
        PROJETO DEMONSTRATIVO · NENHUMA COMPRA OU PAGAMENTO É PROCESSADO DE FORMA REAL
      </div>
      <StoreHeader />
      <main>{children}</main>
      <StoreFooter />
      <CartDrawer />
    </>
  );
}
