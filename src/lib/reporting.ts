import { buildCustomerInsights } from "@/lib/crm";
import { financialSummary, productProfit } from "@/lib/operations";
import type { Order, ReportType, StoreData } from "@/types/store";

export type ReportValue = string | number;
export type ReportValueFormat = "text" | "number" | "money" | "percent" | "date";

export interface ReportColumn {
  key: string;
  label: string;
  format: ReportValueFormat;
}

export interface ReportMetric {
  key: string;
  label: string;
  value: number;
  format: Exclude<ReportValueFormat, "text" | "date">;
}

export interface ReportQuery {
  type: ReportType;
  dateFrom: string;
  dateTo: string;
  comparePrevious: boolean;
  filters: Record<string, string>;
}

export interface ReportResult {
  type: ReportType;
  title: string;
  periodLabel: string;
  columns: ReportColumn[];
  rows: Array<Record<string, ReportValue>>;
  metrics: ReportMetric[];
  comparison: Record<string, { previous: number; changePercent: number | null }>;
  series: Array<{ label: string; value: number }>;
}

export interface InventoryInsight {
  productId: string;
  name: string;
  sku: string;
  stock: number;
  minStock: number;
  soldUnits: number;
  dailyDemand: number;
  coverageDays: number | null;
  leadTimeDays: number;
  incomingUnits: number;
  reorderPoint: number;
  projectedStock: number;
  suggestedQuantity: number;
  marginPercent: number;
  severity: "critical" | "warning" | "attention" | "healthy";
  flags: string[];
}

export const reportTypeLabels: Record<ReportType, string> = {
  sales: "Vendas e pedidos",
  finance: "Financeiro e DRE",
  inventory: "Estoque e reposição",
  customers: "Clientes e recompra",
  cashback: "Cashback e carteira",
  purchases: "Compras e fornecedores",
};

const dayMs = 86_400_000;
const activeOrder = (order: Order) => order.status !== "Cancelado";
const startOfDay = (value: string) => new Date(`${value}T00:00:00`).getTime();
const endOfDay = (value: string) => new Date(`${value}T23:59:59.999`).getTime();
const inRange = (value: string, from: string, to: string) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= startOfDay(from) && time <= endOfDay(to);
};

function periodDays(from: string, to: string) {
  return Math.max(1, Math.round((startOfDay(to) - startOfDay(from)) / dayMs) + 1);
}

export function previousPeriod(from: string, to: string) {
  const days = periodDays(from, to);
  const previousTo = new Date(startOfDay(from) - dayMs);
  const previousFrom = new Date(previousTo.getTime() - (days - 1) * dayMs);
  return { dateFrom: previousFrom.toISOString().slice(0, 10), dateTo: previousTo.toISOString().slice(0, 10) };
}

export function inventoryInsights(data: StoreData, lookbackDays = 90, now = new Date()): InventoryInsight[] {
  const from = now.getTime() - Math.max(1, lookbackDays) * dayMs;
  const orders = data.orders.filter(activeOrder).filter((order) => {
    const created = new Date(order.createdAt).getTime();
    return created >= from && created <= now.getTime();
  });
  const activeSuppliers = data.suppliers.filter((supplier) => supplier.active);
  const defaultLeadTime = activeSuppliers.length
    ? Math.max(1, Math.round(activeSuppliers.reduce((sum, item) => sum + item.leadTimeDays, 0) / activeSuppliers.length))
    : 14;

  return data.products.filter((product) => product.active).map((product) => {
    const soldUnits = orders.reduce((sum, order) => sum + order.items
      .filter((item) => item.productId === product.id)
      .reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const dailyDemand = soldUnits / Math.max(1, lookbackDays);
    const relatedOrders = data.purchaseOrders.filter((order) => order.items.some((item) => item.productId === product.id));
    const latestSupplierId = relatedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.supplierId;
    const leadTimeDays = data.suppliers.find((supplier) => supplier.id === latestSupplierId)?.leadTimeDays || defaultLeadTime;
    const incomingUnits = data.purchaseOrders
      .filter((order) => ["ordered", "partial"].includes(order.status))
      .reduce((sum, order) => sum + order.items.filter((item) => item.productId === product.id).reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const reorderPoint = Math.max(product.minStock, Math.ceil(dailyDemand * (leadTimeDays + 7)));
    const projectedStock = Math.floor(product.stock + incomingUnits - dailyDemand * leadTimeDays);
    const targetStock = Math.max(reorderPoint, Math.ceil(dailyDemand * (leadTimeDays + 30)) + product.minStock);
    const suggestedQuantity = Math.max(0, targetStock - product.stock - incomingUnits);
    const coverageDays = dailyDemand > 0 ? product.stock / dailyDemand : null;
    const marginPercent = productProfit(product).marginPercent;
    const flags: string[] = [];
    if (projectedStock <= 0) flags.push("Ruptura prevista antes da reposição");
    else if (product.stock <= reorderPoint) flags.push("Ponto de reposição atingido");
    if (soldUnits === 0 && product.stock > 0) flags.push("Sem giro no período");
    if (product.costPrice <= 0) flags.push("Custo não informado");
    else if (marginPercent < 20) flags.push("Margem abaixo de 20%");
    if (product.stock < 0 || product.minStock < 0 || product.price < product.costPrice) flags.push("Inconsistência cadastral");
    const severity: InventoryInsight["severity"] = projectedStock <= 0
      ? "critical"
      : product.stock <= reorderPoint
        ? "warning"
        : flags.length
          ? "attention"
          : "healthy";
    return {
      productId: product.id, name: product.name, sku: product.sku, stock: product.stock, minStock: product.minStock,
      soldUnits, dailyDemand, coverageDays, leadTimeDays, incomingUnits, reorderPoint, projectedStock,
      suggestedQuantity, marginPercent, severity, flags,
    };
  }).sort((a, b) => {
    const rank = { critical: 0, warning: 1, attention: 2, healthy: 3 };
    return rank[a.severity] - rank[b.severity] || b.suggestedQuantity - a.suggestedQuantity || a.name.localeCompare(b.name, "pt-BR");
  });
}

function salesReport(data: StoreData, query: ReportQuery): Omit<ReportResult, "comparison"> {
  const primary = query.filters.primary || "all";
  const orders = data.orders.filter(activeOrder).filter((order) => inRange(order.createdAt, query.dateFrom, query.dateTo))
    .filter((order) => primary === "all" || (primary.startsWith("status:") && order.status === primary.slice(7)) || (primary.startsWith("source:") && (order.orderSource || "legacy") === primary.slice(7)));
  const rows = orders.map((order) => ({
    date: order.createdAt.slice(0, 10), code: order.code, customer: order.customer.name, status: order.status,
    source: order.orderSource || "legacy", items: order.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: order.subtotal, discount: order.discount, cashback: order.cashbackTotal, total: order.total,
  }));
  const revenue = orders.reduce((sum, order) => sum + order.total, 0);
  const cost = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity * item.unitCost, 0), 0);
  return {
    type: "sales", title: reportTypeLabels.sales, periodLabel: `${query.dateFrom} a ${query.dateTo}`,
    columns: [
      { key: "date", label: "Data", format: "date" }, { key: "code", label: "Pedido", format: "text" },
      { key: "customer", label: "Cliente", format: "text" }, { key: "status", label: "Status", format: "text" },
      { key: "source", label: "Origem", format: "text" }, { key: "items", label: "Itens", format: "number" },
      { key: "subtotal", label: "Subtotal", format: "money" }, { key: "discount", label: "Desconto", format: "money" },
      { key: "cashback", label: "Cashback", format: "money" }, { key: "total", label: "Total", format: "money" },
    ], rows,
    metrics: [
      { key: "revenue", label: "Receita", value: revenue, format: "money" },
      { key: "orders", label: "Pedidos", value: orders.length, format: "number" },
      { key: "ticket", label: "Ticket médio", value: orders.length ? revenue / orders.length : 0, format: "money" },
      { key: "grossMargin", label: "Margem bruta", value: revenue ? ((revenue - cost) / revenue) * 100 : 0, format: "percent" },
    ],
    series: dailySeries(orders.map((order) => ({ date: order.createdAt, value: order.total }))),
  };
}

function financeReport(data: StoreData, query: ReportQuery): Omit<ReportResult, "comparison"> {
  const primary = query.filters.primary || "all";
  const transactions = data.financialTransactions.filter((item) => inRange(item.createdAt, query.dateFrom, query.dateTo))
    .filter((item) => primary === "all" || (primary.startsWith("status:") && item.status === primary.slice(7)) || (primary.startsWith("type:") && item.type === primary.slice(5)));
  const summary = financialSummary(transactions, new Date(`${query.dateTo}T23:59:59`));
  return {
    type: "finance", title: reportTypeLabels.finance, periodLabel: `${query.dateFrom} a ${query.dateTo}`,
    columns: [
      { key: "date", label: "Data", format: "date" }, { key: "description", label: "Descrição", format: "text" },
      { key: "type", label: "Tipo", format: "text" }, { key: "status", label: "Status", format: "text" },
      { key: "category", label: "Categoria", format: "text" }, { key: "account", label: "Conta", format: "text" },
      { key: "amount", label: "Valor", format: "money" },
    ],
    rows: transactions.map((item) => ({ date: item.createdAt.slice(0, 10), description: item.description, type: item.type === "income" ? "Entrada" : "Saída", status: item.status, category: item.category, account: item.account, amount: item.amount })),
    metrics: [
      { key: "income", label: "Receita realizada", value: summary.income, format: "money" },
      { key: "expenses", label: "Custos e despesas", value: summary.expenses, format: "money" },
      { key: "netProfit", label: "Lucro líquido", value: summary.netProfit, format: "money" },
      { key: "margin", label: "Margem líquida", value: summary.marginPercent, format: "percent" },
    ],
    series: dailySeries(transactions.map((item) => ({ date: item.createdAt, value: item.type === "income" ? item.amount : -item.amount }))),
  };
}

function inventoryReport(data: StoreData, query: ReportQuery): Omit<ReportResult, "comparison"> {
  const days = Math.min(365, periodDays(query.dateFrom, query.dateTo));
  const primary = query.filters.primary || "all";
  const insights = inventoryInsights(data, days, new Date(`${query.dateTo}T23:59:59`))
    .filter((item) => primary === "all" || (primary.startsWith("severity:") && item.severity === primary.slice(9)) || (primary === "reorder" && item.suggestedQuantity > 0) || (primary === "slow" && item.soldUnits === 0 && item.stock > 0));
  const productIds = new Set(insights.map((item) => item.productId));
  const stockValue = data.products.filter((product) => productIds.has(product.id)).reduce((sum, product) => sum + product.stock * product.costPrice, 0);
  return {
    type: "inventory", title: reportTypeLabels.inventory, periodLabel: `Giro observado entre ${query.dateFrom} e ${query.dateTo}`,
    columns: [
      { key: "sku", label: "SKU", format: "text" }, { key: "product", label: "Produto", format: "text" },
      { key: "stock", label: "Estoque", format: "number" }, { key: "sold", label: "Vendido", format: "number" },
      { key: "coverage", label: "Cobertura (dias)", format: "number" }, { key: "incoming", label: "A caminho", format: "number" },
      { key: "reorder", label: "Ponto de reposição", format: "number" }, { key: "suggested", label: "Compra sugerida", format: "number" },
      { key: "margin", label: "Margem", format: "percent" }, { key: "alert", label: "Alerta", format: "text" },
    ],
    rows: insights.map((item) => ({ sku: item.sku, product: item.name, stock: item.stock, sold: item.soldUnits, coverage: item.coverageDays === null ? "Sem giro" : Number(item.coverageDays.toFixed(1)), incoming: item.incomingUnits, reorder: item.reorderPoint, suggested: item.suggestedQuantity, margin: item.marginPercent, alert: item.flags.join("; ") || "Saudável" })),
    metrics: [
      { key: "stockValue", label: "Valor em estoque", value: stockValue, format: "money" },
      { key: "critical", label: "Risco de ruptura", value: insights.filter((item) => item.severity === "critical").length, format: "number" },
      { key: "reorder", label: "Reposição necessária", value: insights.filter((item) => item.suggestedQuantity > 0).length, format: "number" },
      { key: "slow", label: "Sem giro", value: insights.filter((item) => item.soldUnits === 0 && item.stock > 0).length, format: "number" },
    ],
    series: insights.slice(0, 10).map((item) => ({ label: item.name, value: item.suggestedQuantity })),
  };
}

function customersReport(data: StoreData, query: ReportQuery): Omit<ReportResult, "comparison"> {
  const orders = data.orders.filter(activeOrder).filter((order) => inRange(order.createdAt, query.dateFrom, query.dateTo));
  const primary = query.filters.primary || "all";
  const insights = buildCustomerInsights(data.customers, data.orders, new Date(`${query.dateTo}T23:59:59`))
    .filter((customer) => primary === "all" || (primary.startsWith("segment:") && customer.segment === primary.slice(8)));
  const rows = insights.map((customer) => {
    const periodOrders = orders.filter((order) => order.customerId === customer.id);
    return { customer: customer.name, segment: customer.segment, city: customer.city, state: customer.state, orders: periodOrders.length, revenue: periodOrders.reduce((sum, order) => sum + order.total, 0), lastOrder: customer.lastOrderAt ? customer.lastOrderAt.slice(0, 10) : "", daysSince: customer.daysSinceLastOrder ?? "", tags: customer.tags.join(", ") };
  });
  return {
    type: "customers", title: reportTypeLabels.customers, periodLabel: `${query.dateFrom} a ${query.dateTo}`,
    columns: [
      { key: "customer", label: "Cliente", format: "text" }, { key: "segment", label: "Segmento", format: "text" },
      { key: "city", label: "Cidade", format: "text" }, { key: "state", label: "UF", format: "text" },
      { key: "orders", label: "Pedidos", format: "number" }, { key: "revenue", label: "Receita", format: "money" },
      { key: "lastOrder", label: "Última compra", format: "date" }, { key: "daysSince", label: "Dias sem comprar", format: "number" },
      { key: "tags", label: "Tags", format: "text" },
    ], rows,
    metrics: [
      { key: "customers", label: "Clientes", value: insights.length, format: "number" },
      { key: "buyers", label: "Compradores no período", value: new Set(orders.map((order) => order.customerId).filter(Boolean)).size, format: "number" },
      { key: "recurring", label: "Recorrentes e VIP", value: insights.filter((item) => ["recurring", "vip"].includes(item.segment)).length, format: "number" },
      { key: "risk", label: "Em risco ou inativos", value: insights.filter((item) => ["at_risk", "inactive"].includes(item.segment)).length, format: "number" },
    ],
    series: Object.entries(insights.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.segment]: (acc[item.segment] ?? 0) + 1 }), {})).map(([label, value]) => ({ label, value })),
  };
}

function cashbackReport(data: StoreData, query: ReportQuery): Omit<ReportResult, "comparison"> {
  const primary = query.filters.primary || "all";
  const entries = data.cashbackEntries.filter((item) => inRange(item.createdAt, query.dateFrom, query.dateTo))
    .filter((item) => primary === "all" || (primary.startsWith("kind:") && item.kind === primary.slice(5)));
  const credits = entries.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0);
  const debits = entries.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0);
  return {
    type: "cashback", title: reportTypeLabels.cashback, periodLabel: `${query.dateFrom} a ${query.dateTo}`,
    columns: [
      { key: "date", label: "Data", format: "date" }, { key: "customer", label: "Cliente", format: "text" },
      { key: "kind", label: "Movimento", format: "text" }, { key: "description", label: "Descrição", format: "text" },
      { key: "amount", label: "Valor", format: "money" }, { key: "remaining", label: "Disponível", format: "money" },
      { key: "expires", label: "Validade", format: "date" },
    ],
    rows: entries.map((item) => ({ date: item.createdAt.slice(0, 10), customer: data.customers.find((customer) => customer.id === item.customerId)?.name ?? item.customerId, kind: item.kind, description: item.description, amount: item.amount, remaining: item.remainingAmount, expires: item.expiresAt ? item.expiresAt.slice(0, 10) : "" })),
    metrics: [
      { key: "credits", label: "Cashback concedido", value: credits, format: "money" },
      { key: "debits", label: "Cashback consumido", value: debits, format: "money" },
      { key: "balance", label: "Saldo líquido", value: credits - debits, format: "money" },
      { key: "movements", label: "Movimentos", value: entries.length, format: "number" },
    ],
    series: dailySeries(entries.map((item) => ({ date: item.createdAt, value: item.amount }))),
  };
}

function purchasesReport(data: StoreData, query: ReportQuery): Omit<ReportResult, "comparison"> {
  const primary = query.filters.primary || "all";
  const orders = data.purchaseOrders.filter((order) => inRange(order.createdAt, query.dateFrom, query.dateTo))
    .filter((order) => primary === "all" || (primary.startsWith("status:") && order.status === primary.slice(7)));
  const received = orders.filter((order) => order.status === "received");
  return {
    type: "purchases", title: reportTypeLabels.purchases, periodLabel: `${query.dateFrom} a ${query.dateTo}`,
    columns: [
      { key: "date", label: "Data", format: "date" }, { key: "code", label: "Ordem", format: "text" },
      { key: "supplier", label: "Fornecedor", format: "text" }, { key: "status", label: "Status", format: "text" },
      { key: "items", label: "Itens", format: "number" }, { key: "units", label: "Unidades", format: "number" },
      { key: "expected", label: "Previsão", format: "date" }, { key: "total", label: "Total", format: "money" },
    ],
    rows: orders.map((order) => ({ date: order.createdAt.slice(0, 10), code: order.code, supplier: data.suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? "Fornecedor", status: order.status, items: order.items.length, units: order.items.reduce((sum, item) => sum + item.quantity, 0), expected: order.expectedAt, total: order.total })),
    metrics: [
      { key: "ordered", label: "Valor comprado", value: orders.reduce((sum, order) => sum + order.total, 0), format: "money" },
      { key: "orders", label: "Ordens", value: orders.length, format: "number" },
      { key: "received", label: "Recebidas", value: received.length, format: "number" },
      { key: "lead", label: "Lead time médio", value: data.suppliers.length ? data.suppliers.reduce((sum, item) => sum + item.leadTimeDays, 0) / data.suppliers.length : 0, format: "number" },
    ],
    series: dailySeries(orders.map((order) => ({ date: order.createdAt, value: order.total }))),
  };
}

function dailySeries(values: Array<{ date: string; value: number }>) {
  const grouped = values.reduce<Record<string, number>>((acc, item) => {
    const key = item.date.slice(0, 10);
    acc[key] = (acc[key] ?? 0) + item.value;
    return acc;
  }, {});
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label: label.slice(5), value }));
}

function buildBaseReport(data: StoreData, query: ReportQuery) {
  if (query.type === "finance") return financeReport(data, query);
  if (query.type === "inventory") return inventoryReport(data, query);
  if (query.type === "customers") return customersReport(data, query);
  if (query.type === "cashback") return cashbackReport(data, query);
  if (query.type === "purchases") return purchasesReport(data, query);
  return salesReport(data, query);
}

export function buildReport(data: StoreData, query: ReportQuery): ReportResult {
  const current = buildBaseReport(data, query);
  const comparison: ReportResult["comparison"] = {};
  if (query.comparePrevious) {
    const previous = previousPeriod(query.dateFrom, query.dateTo);
    const result = buildBaseReport(data, { ...query, ...previous, comparePrevious: false });
    current.metrics.forEach((metric) => {
      const previousValue = result.metrics.find((item) => item.key === metric.key)?.value ?? 0;
      comparison[metric.key] = { previous: previousValue, changePercent: previousValue === 0 ? null : ((metric.value - previousValue) / Math.abs(previousValue)) * 100 };
    });
  }
  return { ...current, comparison };
}
