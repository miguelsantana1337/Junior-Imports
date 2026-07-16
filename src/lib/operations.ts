import type {
  CustomerTask,
  FinancialTransaction,
  InventoryMovementType,
  Order,
  Product,
} from "@/types/store";

export function productProfit(product: Pick<Product, "price" | "costPrice">) {
  const grossProfit = Math.max(0, product.price - product.costPrice);
  return {
    grossProfit,
    marginPercent: product.price > 0 ? (grossProfit / product.price) * 100 : 0,
  };
}
export function orderCost(order: Pick<Order, "items">) {
  return order.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
}

export function financialSummary(transactions: FinancialTransaction[], now = new Date()) {
  const active = transactions.filter((item) => item.status !== "cancelled");
  const paid = active.filter((item) => item.status === "paid");
  const income = paid.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
  const expenses = paid.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
  const receivable = active.filter((item) => item.type === "income" && item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const payable = active.filter((item) => item.type === "expense" && item.status === "pending").reduce((sum, item) => sum + item.amount, 0);
  const overdue = active.filter((item) => item.status === "pending" && item.dueDate && new Date(`${item.dueDate}T23:59:59`) < now).reduce((sum, item) => sum + item.amount, 0);
  const netProfit = income - expenses;
  return {
    income,
    expenses,
    netProfit,
    marginPercent: income > 0 ? (netProfit / income) * 100 : 0,
    receivable,
    payable,
    overdue,
    projectedBalance: income + receivable - expenses - payable,
  };
}

export function inventoryAlerts(products: Product[]) {
  return products
    .filter((product) => product.active && product.stock <= product.minStock)
    .sort((a, b) => (a.stock - a.minStock) - (b.stock - b.minStock));
}

export function movementStockDelta(type: InventoryMovementType, quantity: number) {
  const safeQuantity = Math.max(0, Math.trunc(quantity));
  return ["sale", "loss"].includes(type) ? -safeQuantity : safeQuantity;
}

export function tasksDueToday(tasks: CustomerTask[], now = new Date()) {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return tasks
    .filter((task) => task.status === "open" && Boolean(task.dueAt) && new Date(task.dueAt) <= end)
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}
