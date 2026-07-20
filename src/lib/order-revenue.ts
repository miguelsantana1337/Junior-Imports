import type { Order, OrderStatus } from "@/types/store";

export const revenueOrderStatuses: ReadonlySet<OrderStatus> = new Set([
  "Pago",
  "Preparando",
  "Enviado",
  "Entregue",
]);

export function isRevenueOrder(order: Pick<Order, "status">) {
  return revenueOrderStatuses.has(order.status);
}

export function confirmedOrderRevenue(orders: Order[], since: Date) {
  return orders
    .filter(isRevenueOrder)
    .filter((order) => new Date(order.createdAt) >= since)
    .reduce((sum, order) => sum + order.total, 0);
}
