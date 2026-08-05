import type { Order, OrderStatus } from "@/types/store";

const archiveableStatuses: ReadonlySet<OrderStatus> = new Set(["Entregue", "Cancelado"]);

export function orderFinancialTotal(order: Pick<Order, "total" | "financialTotal">) {
  const value = Number(order.financialTotal);
  return Number.isFinite(value) && value >= 0 ? value : order.total;
}

export function orderFinancialAdjustment(order: Pick<Order, "total" | "financialTotal" | "financialAdjustment">) {
  const persisted = Number(order.financialAdjustment);
  if (Number.isFinite(persisted)) return persisted;
  return orderFinancialTotal(order) - order.total;
}

export function isOrderArchived(order: Pick<Order, "archivedAt">) {
  return Boolean(order.archivedAt);
}

export function canArchiveOrder(order: Pick<Order, "status">) {
  return archiveableStatuses.has(order.status);
}
