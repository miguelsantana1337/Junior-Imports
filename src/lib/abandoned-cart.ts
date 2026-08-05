import type { TrackedCart, TrackedCartStatus } from "@/types/abandoned-cart";

export const ABANDONED_CART_AFTER_MINUTES = 30;

export function trackedCartStatus(cart: Pick<TrackedCart, "status" | "lastActivityAt">, now = Date.now()): TrackedCartStatus {
  if (cart.status !== "active") return cart.status;
  return now - new Date(cart.lastActivityAt).getTime() >= ABANDONED_CART_AFTER_MINUTES * 60_000
    ? "abandoned"
    : "active";
}

export function cartRecoveryMessage(cart: Pick<TrackedCart, "customerName" | "items">, storeName: string) {
  const firstName = cart.customerName.trim().split(/\s+/)[0] || "tudo bem";
  const itemSummary = cart.items.slice(0, 2).map((item) => `${item.quantity}x ${item.name}`).join(" e ");
  const remaining = cart.items.length > 2 ? ` e mais ${cart.items.length - 2} item(ns)` : "";
  return `Olá, ${firstName}! Aqui é da ${storeName}. Seu carrinho com ${itemSummary}${remaining} ficou aguardando finalização. Posso ajudar você a concluir o pedido?`;
}
