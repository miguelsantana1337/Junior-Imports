import "server-only";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoney, formatStoreDateKey, whatsappUrl } from "@/lib/format";
import type { AdminPermission } from "@/types/store";
import {
  requireMcpPermission,
  requireMcpScope,
  type McpActor,
} from "@/lib/mcp/auth";
import {
  consumeMcpConfirmation,
  createMcpConfirmation,
  enforceMcpRateLimit,
  logMcpToolCall,
} from "@/lib/mcp/confirmations";
import {
  resolveMcpOperationPeriod,
  summarizeMcpCash,
  summarizeMcpInventory,
  summarizeMcpOrders,
} from "@/lib/mcp/operation-metrics";

type JsonObject = Record<string, unknown>;

const oauthMeta = {
  securitySchemes: [{ type: "oauth2", scopes: ["junior.read", "junior.write"] }],
};

function textResult(message: string, data: JsonObject = {}) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: data,
  };
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : "Não foi possível concluir a solicitação.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
    structuredContent: { error: message },
  };
}

function can(actor: McpActor, permission: AdminPermission) {
  return actor.isPlatformAdmin || actor.role === "owner" || actor.permissions.includes(permission);
}

function cleanSearch(value: string) {
  return value.trim().replace(/[%_,()]/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function customerValue(order: JsonObject) {
  return (order.customer && typeof order.customer === "object" ? order.customer : {}) as JsonObject;
}

function orderFinancialTotal(order: JsonObject) {
  return numberValue(order.financial_total ?? order.total);
}

async function operationStartedAt(actor: McpActor) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const { data, error } = await admin.from("store_settings")
    .select("operation_started_at")
    .eq("tenant_id", actor.tenantId)
    .eq("id", "default")
    .maybeSingle();
  if (error) throw new Error(error.message);
  return typeof data?.operation_started_at === "string" ? data.operation_started_at : null;
}

function orderView(order: JsonObject) {
  const customer = customerValue(order);
  const items = Array.isArray(order.order_items) ? order.order_items as JsonObject[] : [];
  const total = orderFinancialTotal(order);
  const paid = numberValue(order.amount_paid);
  return {
    id: order.id,
    code: order.code,
    createdAt: order.created_at,
    customer: {
      id: order.customer_id ?? null,
      name: customer.name ?? "Cliente",
      phone: customer.phone ?? "",
      city: customer.city ?? "",
      state: customer.state ?? "",
    },
    items: items.map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      quantity: numberValue(item.quantity),
      unitPrice: numberValue(item.unit_price),
    })),
    subtotal: numberValue(order.subtotal),
    discount: numberValue(order.discount),
    shipping: numberValue(order.shipping),
    commercialTotal: numberValue(order.total),
    financialTotal: total,
    amountPaid: paid,
    remaining: Math.max(0, Math.round((total - paid) * 100) / 100),
    paymentMethod: order.payment,
    operationalStatus: order.operational_status ?? order.status,
    paymentStatus: order.payment_status ?? "Pendente",
    archived: Boolean(order.archived_at),
    trackingCode: order.tracking_code ?? "",
    cashbackTotal: numberValue(order.cashback_total),
    lifecycleVersion: numberValue(order.lifecycle_version) || 1,
  };
}

const orderSelect = "id, code, created_at, customer, subtotal, discount, shipping, total, financial_total, amount_paid, payment, status, coupon_code, customer_id, operational_status, payment_status, lifecycle_version, archived_at, tracking_code, cashback_total, order_items(id, product_id, product_name, quantity, unit_price)";

async function findOrder(actor: McpActor, reference: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const cleaned = cleanSearch(reference);
  if (!cleaned) throw new Error("Informe o código ou identificador do pedido.");
  let response = await admin.from("orders").select(orderSelect).eq("tenant_id", actor.tenantId).eq("id", cleaned).maybeSingle();
  if (!response.data) response = await admin.from("orders").select(orderSelect).eq("tenant_id", actor.tenantId).ilike("code", cleaned).maybeSingle();
  if (response.error || !response.data) throw new Error("Pedido não encontrado.");
  return response.data as unknown as JsonObject;
}

async function findProduct(actor: McpActor, reference: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const cleaned = cleanSearch(reference);
  if (!cleaned) throw new Error("Informe o produto.");
  const select = "id, name, sku, brand, price, cost_price, stock, min_stock, active, category_id, updated_at";
  let response = await admin.from("products").select(select).eq("tenant_id", actor.tenantId).eq("id", cleaned).maybeSingle();
  if (!response.data) response = await admin.from("products").select(select).eq("tenant_id", actor.tenantId).ilike("sku", cleaned).maybeSingle();
  if (!response.data) {
    const list = await admin.from("products").select(select).eq("tenant_id", actor.tenantId).ilike("name", `%${cleaned}%`).limit(2);
    if ((list.data?.length ?? 0) > 1) throw new Error("Encontrei mais de um produto. Informe o SKU ou o identificador.");
    response = { data: list.data?.[0] ?? null, error: list.error } as typeof response;
  }
  if (response.error || !response.data) throw new Error("Produto não encontrado.");
  return response.data as JsonObject;
}

async function findCustomer(actor: McpActor, reference: string) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const cleaned = cleanSearch(reference);
  if (!cleaned) throw new Error("Informe o cliente.");
  const select = "id, name, email, phone, city, state, source, tags, notes, created_at, updated_at";
  let response = await admin.from("customers").select(select).eq("tenant_id", actor.tenantId).eq("id", cleaned).maybeSingle();
  if (!response.data) {
    const searches = await Promise.all([
      admin.from("customers").select(select).eq("tenant_id", actor.tenantId).ilike("name", `%${cleaned}%`).limit(3),
      admin.from("customers").select(select).eq("tenant_id", actor.tenantId).ilike("email", cleaned).limit(1),
      admin.from("customers").select(select).eq("tenant_id", actor.tenantId).ilike("phone", `%${cleaned.replace(/\D/g, "")}%`).limit(1),
    ]);
    const unique = new Map<string, JsonObject>();
    searches.flatMap((item) => item.data ?? []).forEach((item) => unique.set(item.id, item as JsonObject));
    if (unique.size > 1) throw new Error("Encontrei mais de um cliente. Informe telefone, e-mail ou identificador.");
    response = { data: [...unique.values()][0] ?? null, error: null } as typeof response;
  }
  if (response.error || !response.data) throw new Error("Cliente não encontrado.");
  return response.data as JsonObject;
}

async function runRead<T extends JsonObject>(actor: McpActor, toolName: string, permission: AdminPermission, request: T, handler: () => Promise<ReturnType<typeof textResult>>) {
  const startedAt = Date.now();
  try {
    requireMcpScope(actor, "junior.read");
    requireMcpPermission(actor, permission);
    await enforceMcpRateLimit(actor, "read");
    const result = await handler();
    await logMcpToolCall({ actor, toolName, operation: "read", status: "completed", request, startedAt });
    return result;
  } catch (error) {
    await logMcpToolCall({ actor, toolName, operation: "read", status: "failed", request, startedAt, errorCode: error instanceof Error ? error.name : "error" });
    return errorResult(error);
  }
}

async function runWrite<T extends JsonObject>(input: {
  actor: McpActor;
  toolName: string;
  permission: AdminPermission;
  request: T;
  confirmationToken?: string;
  confirmationPayload: JsonObject;
  summary: string;
  execute: () => Promise<JsonObject>;
}) {
  const startedAt = Date.now();
  try {
    requireMcpScope(input.actor, "junior.write");
    requireMcpPermission(input.actor, input.permission);
    await enforceMcpRateLimit(input.actor, "write");
    if (!input.confirmationToken) {
      const confirmation = await createMcpConfirmation(input.actor, input.toolName, input.confirmationPayload, input.summary);
      await logMcpToolCall({ actor: input.actor, toolName: input.toolName, operation: "write", status: "confirmation_required", request: input.request, confirmationId: confirmation.id, startedAt });
      return textResult(`Confirmação necessária: ${input.summary}`, {
        requiresConfirmation: true,
        confirmationToken: confirmation.token,
        expiresAt: confirmation.expiresAt,
        summary: input.summary,
        instruction: "Mostre este resumo ao usuário e só repita a ferramenta com confirmation_token depois que ele confirmar explicitamente.",
      });
    }
    const confirmationId = await consumeMcpConfirmation(input.actor, input.toolName, input.confirmationPayload, input.confirmationToken);
    const result = await input.execute();
    await logMcpToolCall({ actor: input.actor, toolName: input.toolName, operation: "write", status: "completed", request: input.request, confirmationId, startedAt });
    return textResult("Ação concluída e registrada na auditoria.", { success: true, ...result });
  } catch (error) {
    await logMcpToolCall({ actor: input.actor, toolName: input.toolName, operation: "write", status: "failed", request: input.request, startedAt, errorCode: error instanceof Error ? error.name : "error" });
    return errorResult(error);
  }
}

function nextOrderState(order: JsonObject) {
  const operation = String(order.operational_status ?? order.status ?? "Novo");
  const payment = String(order.payment_status ?? "Pendente");
  if (operation === "Novo") return { operation: "Em atendimento", payment, label: "confirmar o atendimento" };
  if (operation === "Em atendimento") return { operation: "Confirmado", payment, label: "confirmar o pedido" };
  if (operation === "Confirmado" && payment !== "Recebido") throw new Error("Registre o pagamento integral antes de avançar este pedido.");
  if (operation === "Confirmado") return { operation: "Em preparação", payment, label: "iniciar a preparação" };
  if (operation === "Em preparação") return { operation: "Enviado", payment, label: "marcar como enviado" };
  if (operation === "Enviado") return { operation: "Entregue", payment, label: "marcar como entregue" };
  if (["Entregue", "Cancelado"].includes(operation)) throw new Error("O pedido já encerrou o ciclo. Use a ferramenta de arquivamento.");
  throw new Error("Não existe uma próxima ação segura para este pedido.");
}

export function createJuniorImportsMcpServer(actor: McpActor) {
  const server = new McpServer(
    { name: "junior-imports", version: "1.1.0" },
    { instructions: "Você opera a Junior Imports para o usuário autenticado. Consulte antes de agir. Para qualquer ferramenta de escrita, apresente o resumo retornado e espere confirmação explícita antes de reenviar com confirmation_token. Nunca diga que enviou uma mensagem de WhatsApp: apenas prepare o texto e o link para revisão humana." },
  );

  server.registerTool("get_today_overview", {
    title: "Ver prioridades de hoje",
    description: "Resume pedidos, pagamentos, caixa, estoque baixo e clientes próximos da recompra.",
    inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async () => runRead(actor, "get_today_overview", "dashboard", {}, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const [ordersResponse, productsResponse, financeResponse] = await Promise.all([
      can(actor, "orders")
        ? admin.from("orders").select("id, code, created_at, operational_status, payment_status, amount_paid, total, financial_total, archived_at").eq("tenant_id", actor.tenantId).is("archived_at", null).order("created_at", { ascending: false }).limit(250)
        : Promise.resolve({ data: [] }),
      can(actor, "inventory") || can(actor, "catalog")
        ? admin.from("products").select("id, name, sku, stock, min_stock").eq("tenant_id", actor.tenantId).eq("active", true).order("stock", { ascending: true }).limit(250)
        : Promise.resolve({ data: [] }),
      can(actor, "finance")
        ? admin.from("financial_transactions").select("type, status, amount, paid_at, created_at").eq("tenant_id", actor.tenantId).eq("status", "paid").order("created_at", { ascending: false }).limit(500)
        : Promise.resolve({ data: [] }),
    ]);
    const today = formatStoreDateKey(new Date());
    const orders = (ordersResponse.data ?? []) as JsonObject[];
    const products = (productsResponse.data ?? []) as JsonObject[];
    const transactions = (financeResponse.data ?? []) as JsonObject[];
    const newOrders = orders.filter((item) => item.operational_status === "Novo");
    const pendingPayments = orders.filter((item) => ["Pendente", "Parcial"].includes(String(item.payment_status)) && !["Cancelado", "Entregue"].includes(String(item.operational_status)));
    const lowStock = products.filter((item) => numberValue(item.stock) <= Math.max(numberValue(item.min_stock), 10));
    const todayTransactions = transactions.filter((item) => formatStoreDateKey(String(item.paid_at ?? item.created_at)) === today);
    const income = todayTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + numberValue(item.amount), 0);
    const expense = todayTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + numberValue(item.amount), 0);
    const overview = {
      date: today,
      newOrders: newOrders.length,
      pendingPayments: pendingPayments.length,
      lowStock: lowStock.length,
      cash: { income, expense, result: income - expense },
      priorities: [
        ...newOrders.slice(0, 3).map((item) => ({ type: "order", id: item.id, label: `Atender ${item.code}` })),
        ...pendingPayments.slice(0, 3).map((item) => ({ type: "payment", id: item.id, label: `Conferir pagamento ${item.code}` })),
        ...lowStock.slice(0, 3).map((item) => ({ type: "stock", id: item.id, label: `${item.name}: ${item.stock} em estoque` })),
      ].slice(0, 8),
    };
    return textResult(`Hoje há ${overview.newOrders} pedidos novos, ${overview.pendingPayments} pagamentos pendentes e ${overview.lowStock} produtos com estoque baixo. Resultado do caixa: ${formatMoney(overview.cash.result)}.`, overview);
  }));

  server.registerTool("search_admin", {
    title: "Buscar no painel",
    description: "Busca simultaneamente pedidos, clientes e produtos por nome, código, telefone, e-mail ou SKU.",
    inputSchema: { query: z.string().trim().min(2).max(120) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ query }) => runRead(actor, "search_admin", "dashboard", { query }, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const term = cleanSearch(query);
    const [orders, products, customers] = await Promise.all([
      can(actor, "orders") ? admin.from("orders").select("id, code, customer, total, financial_total, operational_status, payment_status").eq("tenant_id", actor.tenantId).ilike("code", `%${term}%`).limit(5) : Promise.resolve({ data: [] }),
      can(actor, "catalog") || can(actor, "inventory") ? admin.from("products").select("id, name, sku, stock, price, active").eq("tenant_id", actor.tenantId).or(`name.ilike.%${term}%,sku.ilike.%${term}%`).limit(8) : Promise.resolve({ data: [] }),
      can(actor, "customers") || can(actor, "crm") ? admin.from("customers").select("id, name, email, phone, city, state").eq("tenant_id", actor.tenantId).or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`).limit(8) : Promise.resolve({ data: [] }),
    ]);
    const result = { orders: orders.data ?? [], products: products.data ?? [], customers: customers.data ?? [] };
    const count = result.orders.length + result.products.length + result.customers.length;
    return textResult(`${count} resultado(s) encontrado(s) para “${term}”.`, result);
  }));

  server.registerTool("get_order", {
    title: "Consultar pedido",
    description: "Mostra itens, cliente, situação operacional, pagamentos, saldo, cashback e próxima ação de um pedido.",
    inputSchema: { order: z.string().trim().min(2).max(120) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order }) => runRead(actor, "get_order", "orders", { order }, async () => {
    const view = orderView(await findOrder(actor, order));
    return textResult(`${view.code}: ${view.operationalStatus}, pagamento ${view.paymentStatus}, ${formatMoney(view.amountPaid)} recebido e ${formatMoney(view.remaining)} restante.`, { order: view });
  }));

  server.registerTool("get_product", {
    title: "Consultar produto e estoque",
    description: "Localiza um produto por nome, SKU ou identificador e mostra preço, custo e saldo.",
    inputSchema: { product: z.string().trim().min(2).max(120) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ product }) => runRead(actor, "get_product", can(actor, "inventory") ? "inventory" : "catalog", { product }, async () => {
    const item = await findProduct(actor, product);
    return textResult(`${item.name}: ${item.stock} unidade(s) em estoque, preço ${formatMoney(numberValue(item.price))}.`, { product: item });
  }));

  server.registerTool("get_orders_summary", {
    title: "Consultar pedidos por período",
    description: "Use esta ferramenta quando o usuário pedir quantidade, faturamento, itens, pagamentos em aberto, situação ou lista de pedidos em um período. Para um único pedido, use get_order.",
    inputSchema: {
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial no formato YYYY-MM-DD. O padrão é o primeiro dia do mês atual."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final no formato YYYY-MM-DD. O padrão é hoje."),
      operational_status: z.enum(["Novo", "Em atendimento", "Confirmado", "Em preparação", "Enviado", "Entregue", "Cancelado"]).optional().describe("Filtra pela situação operacional do pedido."),
      payment_status: z.enum(["Pendente", "Recebido", "Parcial", "Estornado", "Cancelado"]).optional().describe("Filtra pela situação do pagamento."),
      limit: z.number().int().min(1).max(50).default(10).describe("Quantidade máxima de pedidos recentes devolvidos junto do resumo."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ date_from, date_to, operational_status, payment_status, limit }) => runRead(actor, "get_orders_summary", "orders", { date_from: date_from ?? "", date_to: date_to ?? "", operational_status: operational_status ?? "", payment_status: payment_status ?? "", limit }, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const period = resolveMcpOperationPeriod({ dateFrom: date_from, dateTo: date_to, operationStartedAt: await operationStartedAt(actor) });
    let orders: JsonObject[] = [];
    if (period.hasStarted) {
      let query = admin.from("orders")
        .select("id, code, created_at, customer, total, financial_total, amount_paid, status, operational_status, payment_status, order_items(quantity, unit_cost)")
        .eq("tenant_id", actor.tenantId)
        .gte("created_at", period.startsAt)
        .lte("created_at", period.endsAt)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (operational_status) query = query.eq("operational_status", operational_status);
      if (payment_status) query = query.eq("payment_status", payment_status);
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      orders = (data ?? []) as unknown as JsonObject[];
    }
    const summary = summarizeMcpOrders(orders, limit);
    const marginNote = summary.grossMarginIsComplete ? "" : ` ${summary.missingCostItems} item(ns) não possuem custo e podem distorcer a margem.`;
    return textResult(`De ${period.dateFrom} a ${period.dateTo}: ${summary.totalOrders} pedido(s), ${summary.receivedOrders} recebido(s), faturamento de ${formatMoney(summary.revenue)} e ${formatMoney(summary.openAmount)} em aberto.${marginNote}`, {
      period,
      filters: { operationalStatus: operational_status ?? null, paymentStatus: payment_status ?? null },
      summary,
      truncated: orders.length === 2000,
    });
  }));

  server.registerTool("get_inventory_summary", {
    title: "Consultar visão do estoque",
    description: "Use esta ferramenta quando o usuário pedir posição geral do estoque, produtos com saldo baixo ou zerado, total de unidades ou valor armazenado. Para um único produto, use get_product.",
    inputSchema: {
      status: z.enum(["all", "low_stock", "out_of_stock"]).default("all").describe("Use all para a posição geral, low_stock para reposição e out_of_stock para itens zerados."),
      include_inactive: z.boolean().default(false).describe("Inclui produtos inativos quando verdadeiro."),
      limit: z.number().int().min(1).max(100).default(20).describe("Quantidade máxima de produtos devolvidos junto do resumo."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ status, include_inactive, limit }) => runRead(actor, "get_inventory_summary", can(actor, "inventory") ? "inventory" : "catalog", { status, include_inactive, limit }, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const { data, error } = await admin.from("products")
      .select("id, name, sku, brand, price, cost_price, stock, min_stock, active, updated_at")
      .eq("tenant_id", actor.tenantId)
      .order("stock", { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    const summary = summarizeMcpInventory((data ?? []) as unknown as JsonObject[], { status, includeInactive: include_inactive, limit });
    return textResult(`Estoque atual: ${summary.totalProducts} produto(s), ${summary.totalUnits} unidade(s), ${summary.lowStockProducts} com saldo baixo e ${summary.outOfStockProducts} zerado(s). Valor a custo: ${formatMoney(summary.stockValueAtCost)}.`, {
      filters: { status, includeInactive: include_inactive },
      summary,
      truncated: (data?.length ?? 0) === 2000,
    });
  }));

  server.registerTool("get_revenue_summary", {
    title: "Consultar faturamento e caixa",
    description: "Use esta ferramenta quando o usuário pedir faturamento, receita recebida, ticket médio, lucro bruto, margem, despesas ou resultado de caixa em um período. Distingue pedidos faturados de pagamentos efetivamente recebidos.",
    inputSchema: {
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data inicial no formato YYYY-MM-DD. O padrão é o primeiro dia do mês atual."),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Data final no formato YYYY-MM-DD. O padrão é hoje."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ date_from, date_to }) => runRead(actor, "get_revenue_summary", "finance", { date_from: date_from ?? "", date_to: date_to ?? "" }, async () => {
    requireMcpPermission(actor, "orders");
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const period = resolveMcpOperationPeriod({ dateFrom: date_from, dateTo: date_to, operationStartedAt: await operationStartedAt(actor) });
    let orders: JsonObject[] = [];
    let transactions: JsonObject[] = [];
    if (period.hasStarted) {
      const [ordersResponse, transactionsResponse] = await Promise.all([
        admin.from("orders")
          .select("id, code, created_at, customer, total, financial_total, amount_paid, status, operational_status, payment_status, order_items(quantity, unit_cost)")
          .eq("tenant_id", actor.tenantId)
          .gte("created_at", period.startsAt)
          .lte("created_at", period.endsAt)
          .order("created_at", { ascending: false })
          .limit(2000),
        admin.from("financial_transactions")
          .select("id, type, status, amount, category, description, paid_at, created_at, order_id")
          .eq("tenant_id", actor.tenantId)
          .eq("status", "paid")
          .gte("paid_at", period.startsAt)
          .lte("paid_at", period.endsAt)
          .order("paid_at", { ascending: false })
          .limit(2000),
      ]);
      if (ordersResponse.error) throw new Error(ordersResponse.error.message);
      if (transactionsResponse.error) throw new Error(transactionsResponse.error.message);
      orders = (ordersResponse.data ?? []) as unknown as JsonObject[];
      transactions = (transactionsResponse.data ?? []) as unknown as JsonObject[];
    }
    const ordersSummary = summarizeMcpOrders(orders, 10);
    const cash = summarizeMcpCash(transactions);
    const marginNote = ordersSummary.grossMarginIsComplete ? "" : " A margem bruta é estimada porque existem itens sem custo cadastrado.";
    return textResult(`De ${period.dateFrom} a ${period.dateTo}: faturamento de ${formatMoney(ordersSummary.revenue)}, ${formatMoney(cash.orderPayments)} recebido de pedidos e resultado de caixa de ${formatMoney(cash.result)}.${marginNote}`, {
      period,
      revenue: {
        amount: ordersSummary.revenue,
        receivedOrders: ordersSummary.receivedOrders,
        averageTicket: ordersSummary.averageTicket,
        grossCost: ordersSummary.grossCost,
        grossProfit: ordersSummary.grossProfit,
        grossMarginPercent: ordersSummary.grossMarginPercent,
        grossMarginIsComplete: ordersSummary.grossMarginIsComplete,
        missingCostItems: ordersSummary.missingCostItems,
      },
      cash,
      openPayments: { orders: ordersSummary.openPaymentOrders, amount: ordersSummary.openAmount },
      recentOrders: ordersSummary.recentOrders,
      truncated: orders.length === 2000 || transactions.length === 2000,
    });
  }));

  server.registerTool("get_customer", {
    title: "Consultar cliente",
    description: "Mostra cadastro, pedidos recentes e saldo de cashback de um cliente.",
    inputSchema: { customer: z.string().trim().min(2).max(120) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ customer }) => runRead(actor, "get_customer", can(actor, "customers") ? "customers" : "crm", { customer }, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const item = await findCustomer(actor, customer);
    const [orders, cashback] = await Promise.all([
      admin.from("orders").select("id, code, created_at, total, financial_total, operational_status, payment_status").eq("tenant_id", actor.tenantId).eq("customer_id", item.id).order("created_at", { ascending: false }).limit(10),
      admin.rpc("cashback_available_balance", { p_tenant_id: actor.tenantId, p_customer_id: item.id }),
    ]);
    const result = { customer: item, orders: orders.data ?? [], cashbackBalance: numberValue(cashback.data) };
    return textResult(`${item.name}: ${(orders.data ?? []).length} pedido(s) recente(s) e ${formatMoney(result.cashbackBalance)} de cashback disponível.`, result);
  }));

  server.registerTool("get_financial_summary", {
    title: "Ver resumo financeiro",
    description: "Resume entradas, saídas e resultado a partir de uma data.",
    inputSchema: { since: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ since }) => runRead(actor, "get_financial_summary", "finance", { since: since ?? "" }, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const start = since ? new Date(`${since}T00:00:00-03:00`) : new Date(Date.now() - 7 * 86_400_000);
    const { data, error } = await admin.from("financial_transactions").select("type, status, amount, category, description, paid_at, created_at").eq("tenant_id", actor.tenantId).eq("status", "paid").gte("paid_at", start.toISOString()).order("paid_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const transactions = (data ?? []) as JsonObject[];
    const income = transactions.filter((item) => item.type === "income").reduce((sum, item) => sum + numberValue(item.amount), 0);
    const expense = transactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + numberValue(item.amount), 0);
    const summary = { since: start.toISOString(), income, expense, result: income - expense, transactionCount: transactions.length };
    return textResult(`Entradas ${formatMoney(income)}, saídas ${formatMoney(expense)}, resultado ${formatMoney(summary.result)}.`, summary);
  }));

  server.registerTool("list_repurchase_opportunities", {
    title: "Ver oportunidades de recompra",
    description: "Encontra clientes que compraram há algumas semanas e podem receber uma mensagem de recompra.",
    inputSchema: { minimum_days: z.number().int().min(21).max(180).default(35), limit: z.number().int().min(1).max(30).default(10) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ minimum_days, limit }) => runRead(actor, "list_repurchase_opportunities", can(actor, "customers") ? "customers" : "crm", { minimum_days, limit }, async () => {
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const [{ data: customers }, { data: orders }] = await Promise.all([
      admin.from("customers").select("id, name, phone, email").eq("tenant_id", actor.tenantId).limit(1000),
      admin.from("orders").select("id, code, customer_id, created_at, operational_status, payment_status, order_items(product_name, quantity)").eq("tenant_id", actor.tenantId).in("operational_status", ["Em preparação", "Enviado", "Entregue"]).eq("payment_status", "Recebido").order("created_at", { ascending: false }).limit(1000),
    ]);
    const customerMap = new Map((customers ?? []).map((item) => [item.id, item]));
    const latest = new Map<string, JsonObject>();
    (orders ?? []).forEach((order) => {
      if (order.customer_id && !latest.has(order.customer_id)) latest.set(order.customer_id, order as unknown as JsonObject);
    });
    const opportunities = [...latest.entries()].map(([customerId, order]) => {
      const customer = customerMap.get(customerId);
      const days = Math.floor((Date.now() - new Date(String(order.created_at)).getTime()) / 86_400_000);
      return { customerId, name: customer?.name ?? "Cliente", phone: customer?.phone ?? "", email: customer?.email ?? "", daysSinceLastOrder: days, lastOrderCode: order.code, products: order.order_items ?? [] };
    }).filter((item) => item.daysSinceLastOrder >= minimum_days).sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder).slice(0, limit);
    return textResult(`${opportunities.length} cliente(s) estão no período de recompra.`, { opportunities });
  }));

  server.registerTool("prepare_whatsapp_message", {
    title: "Preparar mensagem de WhatsApp",
    description: "Prepara, mas não envia, uma mensagem para confirmar pedido, cobrar, informar pagamento, rastreio, entrega ou pós-venda.",
    inputSchema: { order: z.string().trim().min(2).max(120), purpose: z.enum(["confirm_order", "payment_reminder", "payment_confirmed", "tracking", "delivery_check", "post_sale"]) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order, purpose }) => runRead(actor, "prepare_whatsapp_message", "orders", { order, purpose }, async () => {
    const raw = await findOrder(actor, order);
    const view = orderView(raw);
    const admin = createAdminClient();
    if (!admin) throw new Error("Supabase indisponível.");
    const { data: settings } = await admin.from("store_settings").select("store_name").eq("tenant_id", actor.tenantId).eq("id", "default").maybeSingle();
    const firstName = String(view.customer.name).trim().split(/\s+/)[0] || "cliente";
    const intro = `Olá, ${firstName}! Aqui é da ${settings?.store_name ?? "Junior Imports"}.`;
    const messages = {
      confirm_order: `${intro}\n\nRecebemos o seu pedido ${view.code}, no valor de ${formatMoney(view.financialTotal)}. Posso confirmar os detalhes e seguir com o atendimento por aqui?`,
      payment_reminder: `${intro}\n\nPassando para acompanhar o pedido ${view.code}, que ainda possui ${formatMoney(view.remaining)} a pagar. Se precisar revisar algum dado, estou à disposição.`,
      payment_confirmed: `${intro}\n\nO pagamento do pedido ${view.code} foi confirmado. A equipe seguirá com a preparação e avisará quando houver uma nova atualização.`,
      tracking: `${intro}\n\nO código de rastreamento do pedido ${view.code} é: ${view.trackingCode || "ainda não informado"}.`,
      delivery_check: `${intro}\n\nO pedido ${view.code} aparece como entregue. Deu tudo certo com o recebimento?`,
      post_sale: `${intro}\n\nPassando para saber como foi sua experiência com o pedido ${view.code}. Deu tudo certo com os produtos?`,
    };
    const message = messages[purpose];
    return textResult("Mensagem preparada para revisão humana. Ela não foi enviada.", { message, whatsappUrl: whatsappUrl(String(view.customer.phone), message), sent: false });
  }));

  const confirmationSchema = z.string().trim().optional();

  server.registerTool("advance_order", {
    title: "Avançar pedido",
    description: "Executa somente a próxima etapa operacional segura. Primeiro retorna um resumo; depois da confirmação do usuário, repita com confirmation_token.",
    inputSchema: { order: z.string().trim().min(2).max(120), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order, confirmation_token }) => {
    const raw = await findOrder(actor, order).catch(() => null as never);
    if (!raw) return errorResult(new Error("Pedido não encontrado."));
    const view = orderView(raw);
    const next = nextOrderState(raw);
    const payload = { orderId: view.id, expectedVersion: view.lifecycleVersion, operation: next.operation, payment: next.payment };
    return runWrite({ actor, toolName: "advance_order", permission: "orders", request: { order }, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `Deseja ${next.label} no pedido ${view.code}? Situação atual: ${view.operationalStatus}; próxima: ${next.operation}.`, execute: async () => {
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const { data, error } = await admin.rpc("mcp_update_tenant_order_lifecycle", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_order_id: view.id, p_operational_status: next.operation, p_payment_status: next.payment, p_expected_version: view.lifecycleVersion, p_reason: "Avanço confirmado pelo ChatGPT" });
      if (error) throw new Error(error.message);
      return { order: data };
    } });
  });

  server.registerTool("register_order_payment", {
    title: "Registrar pagamento de pedido",
    description: "Registra pagamento integral ou parcial. Primeiro retorna um resumo; depois da confirmação do usuário, repita com confirmation_token.",
    inputSchema: { order: z.string().trim().min(2).max(120), amount: z.number().positive().max(1_000_000_000), method: z.enum(["Pix", "Cartão", "Dinheiro", "Outro"]), note: z.string().trim().max(300).default(""), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order, amount, method, note, confirmation_token }) => {
    const raw = await findOrder(actor, order).catch(() => null);
    if (!raw) return errorResult(new Error("Pedido não encontrado."));
    const view = orderView(raw);
    const rounded = Math.round(amount * 100) / 100;
    if (rounded > view.remaining) return errorResult(new Error(`O pagamento ultrapassa o saldo de ${formatMoney(view.remaining)}.`));
    const payload = { orderId: view.id, expectedVersion: view.lifecycleVersion, amount: rounded, method, note };
    return runWrite({ actor, toolName: "register_order_payment", permission: "finance", request: { order, amount: rounded, method, note }, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `Registrar ${formatMoney(rounded)} via ${method} no pedido ${view.code}. O saldo passará de ${formatMoney(view.remaining)} para ${formatMoney(view.remaining - rounded)}.`, execute: async () => {
      requireMcpPermission(actor, "orders");
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const detail = [method, note].filter(Boolean).join(" — ");
      const { data, error } = await admin.rpc("mcp_register_tenant_order_payment", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_order_id: view.id, p_amount: rounded, p_paid_at: new Date().toISOString(), p_expected_version: view.lifecycleVersion, p_note: detail });
      if (error) throw new Error(error.message);
      return { payment: data };
    } });
  });

  server.registerTool("cancel_order", {
    title: "Cancelar pedido",
    description: "Cancela o pedido e aciona as reversões atuais de estoque, financeiro e cashback. Exige confirmação explícita.",
    inputSchema: { order: z.string().trim().min(2).max(120), reason: z.string().trim().min(5).max(300), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order, reason, confirmation_token }) => {
    const raw = await findOrder(actor, order).catch(() => null);
    if (!raw) return errorResult(new Error("Pedido não encontrado."));
    const view = orderView(raw);
    const payment = ["Recebido", "Parcial"].includes(String(view.paymentStatus)) ? "Estornado" : "Cancelado";
    const payload = { orderId: view.id, expectedVersion: view.lifecycleVersion, reason, payment };
    return runWrite({ actor, toolName: "cancel_order", permission: "orders", request: { order, reason }, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `Cancelar o pedido ${view.code}. Motivo: ${reason}. Estoque, financeiro e cashback serão tratados pelas regras atuais.`, execute: async () => {
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const { data, error } = await admin.rpc("mcp_update_tenant_order_lifecycle", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_order_id: view.id, p_operational_status: "Cancelado", p_payment_status: payment, p_expected_version: view.lifecycleVersion, p_reason: reason });
      if (error) throw new Error(error.message);
      return { order: data };
    } });
  });

  server.registerTool("archive_order", {
    title: "Arquivar ou restaurar pedido",
    description: "Arquiva um pedido entregue/cancelado ou restaura um pedido arquivado. Exige confirmação explícita.",
    inputSchema: { order: z.string().trim().min(2).max(120), archived: z.boolean(), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order, archived, confirmation_token }) => {
    const raw = await findOrder(actor, order).catch(() => null);
    if (!raw) return errorResult(new Error("Pedido não encontrado."));
    const view = orderView(raw);
    const payload = { orderId: view.id, expectedVersion: view.lifecycleVersion, archived };
    return runWrite({ actor, toolName: "archive_order", permission: "orders", request: { order, archived }, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `${archived ? "Arquivar" : "Restaurar"} o pedido ${view.code}, preservando todo o histórico.`, execute: async () => {
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const { data, error } = await admin.rpc("mcp_set_tenant_order_archived", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_order_id: view.id, p_archived: archived });
      if (error) throw new Error(error.message);
      return { order: data };
    } });
  });

  server.registerTool("adjust_order_total", {
    title: "Ajustar valor financeiro do pedido",
    description: "Altera somente o valor usado no controle financeiro, preservando o checkout original. Exige motivo e confirmação.",
    inputSchema: { order: z.string().trim().min(2).max(120), new_total: z.number().min(0).max(1_000_000_000), reason: z.string().trim().min(5).max(300), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ order, new_total, reason, confirmation_token }) => {
    const raw = await findOrder(actor, order).catch(() => null);
    if (!raw) return errorResult(new Error("Pedido não encontrado."));
    const view = orderView(raw);
    const total = Math.round(new_total * 100) / 100;
    const payload = { orderId: view.id, expectedVersion: view.lifecycleVersion, total, reason };
    return runWrite({ actor, toolName: "adjust_order_total", permission: "finance", request: { order, new_total: total, reason }, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `Alterar o valor financeiro do pedido ${view.code} de ${formatMoney(view.financialTotal)} para ${formatMoney(total)}. Motivo: ${reason}.`, execute: async () => {
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const { data, error } = await admin.rpc("mcp_adjust_tenant_order_financial_total", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_order_id: view.id, p_financial_total: total, p_reason: reason });
      if (error) throw new Error(error.message);
      return { order: data };
    } });
  });

  server.registerTool("record_cash_movement", {
    title: "Registrar entrada ou saída no caixa",
    description: "Registra uma movimentação financeira paga. Exige confirmação explícita.",
    inputSchema: { type: z.enum(["income", "expense"]), amount: z.number().positive().max(1_000_000_000), category: z.string().trim().min(2).max(120), description: z.string().trim().min(3).max(200), notes: z.string().trim().max(500).default(""), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ type, amount, category, description, notes, confirmation_token }) => {
    const rounded = Math.round(amount * 100) / 100;
    const payload = { type, amount: rounded, category, description, notes };
    const label = type === "income" ? "entrada" : "saída";
    return runWrite({ actor, toolName: "record_cash_movement", permission: "finance", request: payload, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `Registrar ${label} de ${formatMoney(rounded)} em “${category}”: ${description}.`, execute: async () => {
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const { data, error } = await admin.rpc("mcp_record_financial_transaction", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_type: type, p_amount: rounded, p_category: category, p_description: description, p_occurred_at: new Date().toISOString(), p_notes: notes });
      if (error) throw new Error(error.message);
      return { transaction: data };
    } });
  });

  server.registerTool("record_inventory_movement", {
    title: "Registrar movimento de estoque",
    description: "Registra entrada, perda, venda, devolução ou ajuste de um produto. Exige confirmação explícita.",
    inputSchema: { product: z.string().trim().min(2).max(120), type: z.enum(["purchase", "sale", "return", "adjustment", "loss"]), quantity: z.number().int().positive().max(100000), unit_cost: z.number().min(0).max(1_000_000_000).default(0), note: z.string().trim().min(3).max(300), confirmation_token: confirmationSchema },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    _meta: oauthMeta,
  }, async ({ product, type, quantity, unit_cost, note, confirmation_token }) => {
    const item = await findProduct(actor, product).catch(() => null);
    if (!item) return errorResult(new Error("Produto não encontrado."));
    const currentStock = numberValue(item.stock);
    const delta = ["sale", "loss"].includes(type) ? -quantity : quantity;
    if (currentStock + delta < 0) return errorResult(new Error(`Estoque insuficiente. Saldo atual: ${currentStock}.`));
    const payload = { productId: item.id, expectedStock: currentStock, type, quantity, unitCost: unit_cost, note };
    return runWrite({ actor, toolName: "record_inventory_movement", permission: "inventory", request: { product, type, quantity, unit_cost, note }, confirmationToken: confirmation_token, confirmationPayload: payload, summary: `Registrar ${quantity} unidade(s) como “${type}” em ${item.name}. Estoque: ${currentStock} -> ${currentStock + delta}.`, execute: async () => {
      const refreshed = await findProduct(actor, String(item.id));
      if (numberValue(refreshed.stock) !== currentStock) throw new Error("O estoque mudou desde a confirmação. Prepare a ação novamente.");
      const admin = createAdminClient();
      if (!admin) throw new Error("Supabase indisponível.");
      const { data, error } = await admin.rpc("mcp_record_inventory_movement", { p_actor_id: actor.id, p_actor_email: actor.email, p_tenant_id: actor.tenantId, p_product_id: item.id, p_type: type, p_quantity: quantity, p_unit_cost: unit_cost, p_note: note });
      if (error) throw new Error(error.message);
      return { movement: data };
    } });
  });

  return server;
}
