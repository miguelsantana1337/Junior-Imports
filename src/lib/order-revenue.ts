import type { Order, OrderStatus } from "@/types/store";
import { orderFinancialTotal } from "@/lib/order-finance";

export const revenueOrderStatuses: ReadonlySet<OrderStatus> = new Set([
  "Pago",
  "Entregue",
]);

export function isRevenueOrder(order: Pick<Order, "status">) {
  return revenueOrderStatuses.has(order.status);
}

export function confirmedOrderRevenue(orders: Order[], since: Date) {
  return orders
    .filter(isRevenueOrder)
    .filter((order) => new Date(order.createdAt) >= since)
    .reduce((sum, order) => sum + orderFinancialTotal(order), 0);
}
