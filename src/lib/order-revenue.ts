import type { Order } from "@/types/store";
import { orderFinancialTotal } from "@/lib/order-finance";
import { orderOperationalStatus, orderPaymentStatus } from "@/lib/order-lifecycle";

export function isRevenueOrder(order: Pick<Order, "status" | "operationalStatus" | "paymentStatus">) {
  return orderPaymentStatus(order) === "Recebido" && orderOperationalStatus(order) !== "Cancelado";
}

export function confirmedOrderRevenue(orders: Order[], since: Date) {
  return orders
    .filter(isRevenueOrder)
    .filter((order) => new Date(order.createdAt) >= since)
    .reduce((sum, order) => sum + orderFinancialTotal(order), 0);
}
