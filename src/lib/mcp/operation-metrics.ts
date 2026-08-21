import { formatStoreDateKey } from "@/lib/format";

type DataRow = Record<string, unknown>;

const storeUtcOffset = "-03:00";

function numeric(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function orderTotal(order: DataRow) {
  return numeric(order.financial_total ?? order.total);
}

function orderItems(order: DataRow) {
  return Array.isArray(order.order_items) ? order.order_items as DataRow[] : [];
}

export function resolveMcpOperationPeriod(input: {
  dateFrom?: string;
  dateTo?: string;
  operationStartedAt?: string | null;
  now?: Date;
}) {
  const today = formatStoreDateKey(input.now ?? new Date());
  const requestedDateFrom = input.dateFrom || `${today.slice(0, 7)}-01`;
  const requestedDateTo = input.dateTo || today;
  if (requestedDateFrom > requestedDateTo) throw new Error("A data inicial não pode ser posterior à data final.");

  const requestedStart = new Date(`${requestedDateFrom}T00:00:00.000${storeUtcOffset}`);
  const end = new Date(`${requestedDateTo}T23:59:59.999${storeUtcOffset}`);
  const operationStart = input.operationStartedAt ? new Date(input.operationStartedAt) : null;
  const validOperationStart = operationStart && Number.isFinite(operationStart.getTime()) ? operationStart : null;
  const start = validOperationStart && validOperationStart > requestedStart ? validOperationStart : requestedStart;

  return {
    requestedDateFrom,
    requestedDateTo,
    dateFrom: formatStoreDateKey(start),
    dateTo: requestedDateTo,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    operationStartedAt: validOperationStart?.toISOString() ?? null,
    limitedByOperationStart: Boolean(validOperationStart && validOperationStart > requestedStart),
    hasStarted: start <= end,
  };
}

export function summarizeMcpOrders(orders: DataRow[], recentLimit = 10) {
  const active = orders.filter((order) => text(order.operational_status ?? order.status) !== "Cancelado");
  const received = active.filter((order) => text(order.payment_status) === "Recebido");
  const open = active.filter((order) => ["Pendente", "Parcial"].includes(text(order.payment_status, "Pendente")));
  const revenue = received.reduce((sum, order) => sum + orderTotal(order), 0);
  const grossCost = received.reduce((sum, order) => sum + orderItems(order).reduce(
    (itemSum, item) => itemSum + numeric(item.quantity) * numeric(item.unit_cost),
    0,
  ), 0);
  const missingCostItems = received.reduce((sum, order) => sum + orderItems(order)
    .filter((item) => numeric(item.quantity) > 0 && numeric(item.unit_cost) <= 0).length, 0);
  const openAmount = open.reduce((sum, order) => sum + Math.max(0, orderTotal(order) - numeric(order.amount_paid)), 0);
  const statusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const status = text(order.operational_status ?? order.status, "Não informado");
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});
  const paymentStatusCounts = orders.reduce<Record<string, number>>((counts, order) => {
    const status = text(order.payment_status, "Pendente");
    counts[status] = (counts[status] ?? 0) + 1;
    return counts;
  }, {});

  return {
    totalOrders: orders.length,
    activeOrders: active.length,
    cancelledOrders: orders.length - active.length,
    receivedOrders: received.length,
    openPaymentOrders: open.length,
    openAmount,
    unitsOrdered: active.reduce((sum, order) => sum + orderItems(order).reduce(
      (itemSum, item) => itemSum + numeric(item.quantity),
      0,
    ), 0),
    revenue,
    averageTicket: received.length ? revenue / received.length : 0,
    grossCost,
    grossProfit: revenue - grossCost,
    grossMarginPercent: revenue ? ((revenue - grossCost) / revenue) * 100 : 0,
    grossMarginIsComplete: missingCostItems === 0,
    missingCostItems,
    statusCounts,
    paymentStatusCounts,
    recentOrders: orders.slice(0, recentLimit).map((order) => {
      const customer = order.customer && typeof order.customer === "object" ? order.customer as DataRow : {};
      const total = orderTotal(order);
      const amountPaid = numeric(order.amount_paid);
      return {
        id: order.id,
        code: order.code,
        createdAt: order.created_at,
        customer: text(customer.name, "Cliente"),
        operationalStatus: text(order.operational_status ?? order.status, "Não informado"),
        paymentStatus: text(order.payment_status, "Pendente"),
        total,
        amountPaid,
        remaining: Math.max(0, total - amountPaid),
      };
    }),
  };
}

export function summarizeMcpInventory(products: DataRow[], options: {
  status?: "all" | "low_stock" | "out_of_stock";
  includeInactive?: boolean;
  limit?: number;
} = {}) {
  const considered = options.includeInactive ? products : products.filter((product) => product.active !== false);
  const lowStock = considered.filter((product) => numeric(product.stock) <= Math.max(numeric(product.min_stock), 10));
  const outOfStock = considered.filter((product) => numeric(product.stock) <= 0);
  const filtered = options.status === "low_stock"
    ? lowStock
    : options.status === "out_of_stock"
      ? outOfStock
      : considered;
  const sorted = [...filtered].sort((a, b) => numeric(a.stock) - numeric(b.stock)
    || text(a.name).localeCompare(text(b.name), "pt-BR"));

  return {
    totalProducts: considered.length,
    totalUnits: considered.reduce((sum, product) => sum + numeric(product.stock), 0),
    lowStockProducts: lowStock.length,
    outOfStockProducts: outOfStock.length,
    stockValueAtCost: considered.reduce((sum, product) => sum + Math.max(0, numeric(product.stock)) * numeric(product.cost_price), 0),
    stockValueAtRetail: considered.reduce((sum, product) => sum + Math.max(0, numeric(product.stock)) * numeric(product.price), 0),
    products: sorted.slice(0, options.limit ?? 20).map((product) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      active: product.active !== false,
      stock: numeric(product.stock),
      minStock: numeric(product.min_stock),
      price: numeric(product.price),
      costPrice: numeric(product.cost_price),
      needsReview: numeric(product.stock) <= Math.max(numeric(product.min_stock), 10),
    })),
  };
}

export function summarizeMcpCash(transactions: DataRow[]) {
  const incomeRows = transactions.filter((transaction) => transaction.type === "income");
  const expenseRows = transactions.filter((transaction) => transaction.type === "expense");
  const income = incomeRows.reduce((sum, transaction) => sum + numeric(transaction.amount), 0);
  const expenses = expenseRows.reduce((sum, transaction) => sum + numeric(transaction.amount), 0);
  const orderPayments = incomeRows.filter((transaction) => Boolean(transaction.order_id))
    .reduce((sum, transaction) => sum + numeric(transaction.amount), 0);

  return {
    income,
    orderPayments,
    otherIncome: income - orderPayments,
    expenses,
    result: income - expenses,
    transactionCount: transactions.length,
  };
}
