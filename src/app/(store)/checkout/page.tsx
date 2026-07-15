import type { Metadata } from "next";
import { CheckoutScreen } from "@/components/checkout/checkout-screen";

export const metadata: Metadata = { title: "Finalizar pedido" };

export default function CheckoutPage() {
  return <CheckoutScreen />;
}
