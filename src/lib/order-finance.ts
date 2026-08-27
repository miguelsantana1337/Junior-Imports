import { orderOperationalStatus, orderPaymentStatus } from "@/lib/order-lifecycle";
import type { Order, OrderOperationalStatus } from "@/types/store";

const archiveableStatuses: ReadonlySet<OrderOperationalStatus> = new Set(["Entregue", "Cancelado"]);

export function orderFinancialTotal(order: Pick<Order, "total" | "financialTotal">) {
  const value = Number(order.financialTotal);
  return Number.isFinite(value) && value >= 0 ? value : order.total;
}

export function orderFinancialAdjustment(order: Pick<Order, "total" | "financialTotal" | "financialAdjustment">) {
  const persisted = Number(order.financialAdjustment);
  if (Number.isFinite(persisted)) return persisted;
  return orderFinancialTotal(order) - order.total;
}

export function isOrderArchived(order: Pick<Order, "archivedAt" | "archiveAfter">, now = new Date()) {
  if (order.archivedAt) return true;
  if (!order.archiveAfter) return false;
  const archiveTime = new Date(order.archiveAfter).getTime();
  return Number.isFinite(archiveTime) && archiveTime <= now.getTime();
}

export function canArchiveOrder(order: Pick<Order, "status" | "operationalStatus" | "paymentStatus">) {
  const operational = orderOperationalStatus(order);
  if (!archiveableStatuses.has(operational)) return false;
  return operational === "Cancelado" || orderPaymentStatus(order) === "Recebido";
}
