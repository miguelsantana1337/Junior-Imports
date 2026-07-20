import type { AdminHealthReport } from "@/lib/admin-health";
import type { AdminNotificationCategory } from "@/lib/admin-preferences";
import type { StoreData } from "@/types/store";

export type AdminNotificationPriority = "critical" | "important" | "info";

export interface AdminNotification {
  id: string;
  category: AdminNotificationCategory;
  priority: AdminNotificationPriority;
  title: string;
  description: string;
  href: string;
  createdAt: string;
  sourceId: string;
}

export interface AdminNotificationUser {
  email: string;
  fullName: string;
}

export const adminNotificationCategoryLabels: Record<AdminNotificationCategory, string> = {
  inventory: "Estoque",
  orders: "Pedidos",
  crm: "CRM",
  purchasing: "Compras",
  collaboration: "Equipe",
  cashback: "Cashback",
  marketing: "Marketing",
  security: "Segurança",
  system: "Sistema",
};

export const adminNotificationPriorityLabels: Record<AdminNotificationPriority, string> = {
  critical: "Crítica",
  important: "Importante",
  info: "Informativa",
};

const priorityWeight: Record<AdminNotificationPriority, number> = { critical: 3, important: 2, info: 1 };
const day = 86_400_000;

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function ongoingId(base: string, priority: AdminNotificationPriority, now: number) {
  return `${base}:${priority}:${dayKey(now)}`;
}

function remainingDays(value: string, now: number) {
  const parsed = timestamp(value);
  return parsed === null ? null : Math.ceil((parsed - now) / day);
}

function elapsedHours(value: string, now: number) {
  const parsed = timestamp(value);
  return parsed === null ? 0 : Math.max(0, Math.floor((now - parsed) / 3_600_000));
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function sortAdminNotifications(notifications: AdminNotification[]) {
  return [...notifications].sort((left, right) => {
    const priority = priorityWeight[right.priority] - priorityWeight[left.priority];
    if (priority) return priority;
    return (timestamp(right.createdAt) ?? 0) - (timestamp(left.createdAt) ?? 0);
  });
}

export function buildAdminNotifications(
  data: StoreData,
  user: AdminNotificationUser,
  options: { now?: number; health?: AdminHealthReport | null } = {},
) {
  const now = options.now ?? Date.now();
  const detectedAt = new Date(now).toISOString();
  const notifications: AdminNotification[] = [];
  const add = (notification: AdminNotification) => notifications.push(notification);

  for (const product of data.products.filter((item) => item.active && item.stock <= item.minStock)) {
    const critical = product.stock <= 0;
    const priority: AdminNotificationPriority = critical ? "critical" : "important";
    add({
      id: ongoingId(`inventory:${critical ? "out" : "low"}:${product.id}`, priority, now),
      category: "inventory",
      priority,
      title: critical ? `${product.name} está sem estoque` : `${product.name} atingiu o estoque mínimo`,
      description: critical ? "O produto continua ativo na loja e precisa de reposição." : `${product.stock} ${product.stock === 1 ? "unidade disponível" : "unidades disponíveis"}; mínimo configurado: ${product.minStock}.`,
      href: `/admin/products/${product.id}`,
      createdAt: detectedAt,
      sourceId: product.id,
    });
  }

  for (const lot of data.productLots.filter((item) => item.quantity > 0)) {
    const days = remainingDays(lot.expiryDate, now);
    if (days === null || (days > 30 && lot.status !== "expired")) continue;
    const product = data.products.find((item) => item.id === lot.productId);
    const expired = lot.status === "expired" || days < 0;
    const priority: AdminNotificationPriority = expired ? "critical" : "important";
    add({
      id: ongoingId(`inventory:lot:${expired ? "expired" : "expiring"}:${lot.id}`, priority, now),
      category: "inventory",
      priority,
      title: expired ? `Lote ${lot.code} está vencido` : days === 0 ? `Lote ${lot.code} vence hoje` : `Lote ${lot.code} vence em ${days} dia${days === 1 ? "" : "s"}`,
      description: `${product?.name || "Produto"} · ${lot.quantity} unidade${lot.quantity === 1 ? "" : "s"} no lote.`,
      href: "/admin/inventory",
      createdAt: lot.expiryDate || detectedAt,
      sourceId: lot.id,
    });
  }

  for (const order of data.orders.filter((item) => item.status === "Novo")) {
    const hours = elapsedHours(order.createdAt, now);
    const priority: AdminNotificationPriority = hours >= 24 ? "critical" : "important";
    add({
      id: ongoingId(`orders:contact:${order.id}`, priority, now),
      category: "orders",
      priority,
      title: `Pedido ${order.code} aguarda contato`,
      description: hours > 0 ? `${order.customer.name || "Cliente"} espera acompanhamento há ${hours} hora${hours === 1 ? "" : "s"}.` : `${order.customer.name || "Cliente"} enviou um novo pedido.`,
      href: "/admin/orders",
      createdAt: order.createdAt,
      sourceId: order.id,
    });
  }

  const normalizedEmail = user.email.toLowerCase();
  const normalizedName = user.fullName.toLowerCase();
  for (const task of data.customerTasks.filter((item) => {
    if (item.status !== "open" || !item.dueAt) return false;
    const assignment = item.assignedTo.trim().toLowerCase();
    return !assignment || assignment === normalizedEmail || (normalizedName && assignment === normalizedName);
  })) {
    const dueAt = timestamp(task.dueAt);
    if (dueAt === null || dueAt - now > day) continue;
    const overdue = dueAt < now;
    const priority: AdminNotificationPriority = overdue ? "critical" : "important";
    add({
      id: ongoingId(`crm:task:${task.id}`, priority, now),
      category: "crm",
      priority,
      title: overdue ? `Tarefa atrasada: ${task.title}` : `Tarefa vence nas próximas 24 horas`,
      description: task.notes || "Abra o CRM para registrar o próximo passo.",
      href: "/admin/crm",
      createdAt: task.dueAt,
      sourceId: task.id,
    });
  }

  for (const purchase of data.purchaseOrders.filter((item) => ["ordered", "partial"].includes(item.status) && item.expectedAt)) {
    const days = remainingDays(purchase.expectedAt, now);
    if (days === null || days > 3) continue;
    const overdue = days < 0;
    const priority: AdminNotificationPriority = overdue ? "critical" : "important";
    add({
      id: ongoingId(`purchasing:expected:${purchase.id}`, priority, now),
      category: "purchasing",
      priority,
      title: overdue ? `${purchase.code} está atrasada` : days === 0 ? `${purchase.code} tem chegada prevista para hoje` : `${purchase.code} chega em até ${days} dia${days === 1 ? "" : "s"}`,
      description: purchase.status === "partial" ? "A ordem foi recebida parcialmente e ainda possui itens pendentes." : "Confira o fornecedor e prepare o recebimento do estoque.",
      href: "/admin/purchasing",
      createdAt: purchase.expectedAt,
      sourceId: purchase.id,
    });
  }

  const expiringCashback = data.cashbackEntries.filter((entry) => entry.remainingAmount > 0 && entry.expiresAt && (remainingDays(entry.expiresAt, now) ?? 999) >= 0 && (remainingDays(entry.expiresAt, now) ?? 999) <= 7);
  if (expiringCashback.length) {
    const total = expiringCashback.reduce((sum, entry) => sum + entry.remainingAmount, 0);
    add({
      id: ongoingId("cashback:expiring", "important", now),
      category: "cashback",
      priority: "important",
      title: `${expiringCashback.length} crédito${expiringCashback.length === 1 ? "" : "s"} de cashback perto do vencimento`,
      description: `${currency(total)} ainda podem ser usados pelos clientes nos próximos 7 dias.`,
      href: "/admin/customers",
      createdAt: detectedAt,
      sourceId: "cashback-expiring",
    });
  }

  for (const campaign of data.cashbackCampaigns.filter((item) => item.status === "active" && item.endsAt)) {
    const days = remainingDays(campaign.endsAt, now);
    if (days === null || days < 0 || days > 3) continue;
    add({
      id: ongoingId(`cashback:campaign-ending:${campaign.id}`, "important", now),
      category: "cashback",
      priority: "important",
      title: days === 0 ? `${campaign.name} termina hoje` : `${campaign.name} termina em ${days} dia${days === 1 ? "" : "s"}`,
      description: "Revise os resultados e decida se a campanha será encerrada, prorrogada ou substituída.",
      href: "/admin/customers",
      createdAt: campaign.endsAt,
      sourceId: campaign.id,
    });
  }

  const latestRunByAutomation = new Map<string, StoreData["automationRuns"][number]>();
  for (const run of data.automationRuns) {
    if (!latestRunByAutomation.has(run.automationId)) latestRunByAutomation.set(run.automationId, run);
  }
  for (const run of latestRunByAutomation.values()) {
    if (!["failed", "retrying"].includes(run.status)) continue;
    const exhausted = run.status === "failed" && run.attempt >= run.maxAttempts;
    const priority: AdminNotificationPriority = exhausted ? "critical" : "important";
    add({
      id: ongoingId(`marketing:automation:${run.automationId}`, priority, now),
      category: "marketing",
      priority,
      title: exhausted ? `Automação ${run.automationName} esgotou as tentativas` : `Automação ${run.automationName} precisa de atenção`,
      description: run.errorMessage || (run.status === "retrying" ? "Uma nova tentativa está programada." : "Abra o histórico para revisar a falha."),
      href: "/admin/messages",
      createdAt: run.createdAt,
      sourceId: run.id,
    });
  }

  for (const publication of data.marketingPublications.filter((item) => item.status === "scheduled" && item.startsAt)) {
    const startsAt = timestamp(publication.startsAt);
    if (startsAt === null || startsAt - now > day) continue;
    const overdue = startsAt < now;
    const priority: AdminNotificationPriority = overdue ? "critical" : "info";
    add({
      id: ongoingId(`marketing:publication:${publication.id}`, priority, now),
      category: "marketing",
      priority,
      title: overdue ? `${publication.name} não foi publicada no horário` : `${publication.name} será publicada em breve`,
      description: overdue ? "O horário programado passou e o conteúdo continua aguardando publicação." : "Revise o conteúdo e a aprovação antes do horário agendado.",
      href: "/admin/messages",
      createdAt: publication.startsAt,
      sourceId: publication.id,
    });
  }

  const securityWindow = now - day;
  for (const event of data.auditLogs.filter((item) => (timestamp(item.createdAt) ?? 0) >= securityWindow && ["auth_mfa_factors", "profiles", "tenant_members"].includes(item.entityType))) {
    const mfaRemoval = event.entityType === "auth_mfa_factors" && event.action === "delete";
    const title = event.entityType === "auth_mfa_factors"
      ? event.action === "insert" ? "Novo autenticador MFA cadastrado" : "Autenticador MFA removido"
      : "Acesso administrativo foi alterado";
    add({
      id: `security:${event.id}`,
      category: "security",
      priority: mfaRemoval ? "critical" : "important",
      title,
      description: `${event.actorEmail || "Administrador"} alterou ${event.entityLabel || "uma configuração de acesso"}.`,
      href: event.entityType === "auth_mfa_factors" ? "/admin/security" : "/admin/users",
      createdAt: event.createdAt,
      sourceId: event.id,
    });
  }

  if (options.health && options.health.environment !== "local") {
    for (const check of options.health.checks.filter((item) => item.status === "critical" || item.status === "warning")) {
      const priority: AdminNotificationPriority = check.status === "critical" ? "critical" : "important";
      add({
        id: ongoingId(`system:${check.id}`, priority, now),
        category: check.id === "authentication" ? "security" : "system",
        priority,
        title: check.summary,
        description: check.detail,
        href: check.id === "authentication" ? "/admin/security" : "/admin/data",
        createdAt: check.observedAt || options.health.checkedAt,
        sourceId: check.id,
      });
    }
  }

  return sortAdminNotifications(notifications);
}
