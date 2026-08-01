import { formatMoney } from "@/lib/format";
import type { ShippingStatus } from "@/types/store";

export function shippingPriceLabel(status: ShippingStatus | undefined, amount: number) {
  if (status === "pickup") return "Retirada no local";
  if (status === "quote") return "A cotar pelo CEP";
  if (status === "pending") return "Informe o CEP";
  if (status === "free" || amount <= 0) return "Grátis";
  return formatMoney(amount);
}

export function orderTotalLabel(status: ShippingStatus | undefined) {
  return status === "quote" || status === "pending" ? "Total parcial (sem frete)" : "Total do pedido";
}
