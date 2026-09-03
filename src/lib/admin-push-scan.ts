import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAdminPush, type AdminPushPayload } from "@/lib/admin-push";

const hour = 3_600_000;
const day = 86_400_000;

function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function dateValue(value: unknown) {
  const parsed = new Date(String(value ?? "")).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export async function scanAdminPushTenant(client: SupabaseClient, tenantId: string, now = Date.now()) {
  const candidates: AdminPushPayload[] = [];
  const warnings: string[] = [];
  const today = dayKey(now);
  const recentBoundary = new Date(now - 3 * hour).toISOString();
  const staleBoundary = new Date(now - day).toISOString();

  const [recentOrders, staleOrders, products, securityEvents, carts] = await Promise.all([
    client.from("orders").select("id, code, created_at").eq("tenant_id", tenantId).eq("status", "Novo").gte("created_at", recentBoundary).limit(100),
    client.from("orders").select("id, code, created_at").eq("tenant_id", tenantId).eq("status", "Novo").lte("created_at", staleBoundary).order("created_at", { ascending: true }).limit(100),
    client.from("products").select("id, name, stock, min_stock, active, made_to_order").eq("tenant_id", tenantId).eq("active", true).limit(1000),
    client.from("audit_logs").select("id, entity_type, action, created_at").eq("tenant_id", tenantId).in("entity_type", ["auth_mfa_factors", "profiles", "tenant_members"]).gte("created_at", new Date(now - day).toISOString()).limit(100),
    client.from("storefront_cart_sessions").select("id, last_activity_at, status").eq("tenant_id", tenantId).eq("status", "active").lte("last_activity_at", new Date(now - 45 * 60_000).toISOString()).limit(100),
  ]);

  if (recentOrders.error) warnings.push("pedidos recentes");
  for (const order of recentOrders.data ?? []) {
    candidates.push({
      notificationKey: `order-created:${order.id}`,
      category: "orders",
      priority: "critical",
      title: "Novo pedido recebido",
      body: `O pedido ${String(order.code || "novo")} está aguardando conferência no painel.`,
      href: "/admin/orders",
    });
  }

  if (staleOrders.error) warnings.push("pedidos pendentes");
  const stale = staleOrders.data ?? [];
  if (stale.length) {
    const oldestAt = dateValue(stale[0]?.created_at);
    const hours = oldestAt === null ? 24 : Math.max(24, Math.floor((now - oldestAt) / hour));
    candidates.push({
      notificationKey: `orders-pending:${today}`,
      category: "orders",
      priority: hours >= 48 ? "critical" : "important",
      title: `${stale.length} ${stale.length === 1 ? "pedido continua" : "pedidos continuam"} pendente${stale.length === 1 ? "" : "s"}`,
      body: `A pendência mais antiga está aberta há ${hours} horas. Abra o painel para acompanhar.`,
      href: "/admin/orders",
    });
  }

  if (products.error) warnings.push("estoque");
  const unavailableProducts: string[] = [];
  const lowProducts: string[] = [];
  for (const product of products.data ?? []) {
    if (product.made_to_order) continue;
    const stock = Number(product.stock) || 0;
    const minimum = Math.max(0, Number(product.min_stock) || 0);
    if (stock > minimum) continue;
    (stock <= 0 ? unavailableProducts : lowProducts).push(String(product.name || "Produto"));
  }
  if (unavailableProducts.length) {
    candidates.push({
      notificationKey: `inventory:out:${today}`,
      category: "inventory",
      priority: "critical",
      title: `${unavailableProducts.length} ${unavailableProducts.length === 1 ? "produto está" : "produtos estão"} sem estoque`,
      body: `${unavailableProducts.slice(0, 2).join(" e ").slice(0, 180)}${unavailableProducts.length > 2 ? " e outros precisam de revisão." : " precisa de revisão."}`,
      href: "/admin/products",
    });
  }
  if (lowProducts.length) {
    candidates.push({
      notificationKey: `inventory:low:${today}`,
      category: "inventory",
      priority: "important",
      title: `${lowProducts.length} ${lowProducts.length === 1 ? "produto atingiu" : "produtos atingiram"} o estoque mínimo`,
      body: "Revise o catálogo e prepare a reposição necessária.",
      href: "/admin/products",
    });
  }

  if (securityEvents.error) warnings.push("segurança");
  for (const event of securityEvents.data ?? []) {
    const removedMfa = event.entity_type === "auth_mfa_factors" && event.action === "delete";
    candidates.push({
      notificationKey: `security:${event.id}`,
      category: "security",
      priority: removedMfa ? "critical" : "important",
      title: removedMfa ? "Autenticador MFA removido" : "Acesso administrativo alterado",
      body: "Confira o registro de segurança do painel.",
      href: event.entity_type === "auth_mfa_factors" ? "/admin/security" : "/admin/users",
    });
  }

  if (carts.error) warnings.push("carrinhos abandonados");
  const abandonedCount = (carts.data ?? []).length;
  if (abandonedCount) {
    candidates.push({
      notificationKey: `abandoned-carts:${today}`,
      category: "marketing",
      priority: "important",
      title: `${abandonedCount} ${abandonedCount === 1 ? "carrinho aguarda" : "carrinhos aguardam"} recuperação`,
      body: "Abra a lista para decidir quais clientes devem receber acompanhamento.",
      href: "/admin/abandoned-carts",
    });
  }

  const limited = candidates.slice(0, 250);
  let sent = 0;
  let failed = 0;
  for (const candidate of limited) {
    try {
      const result = await sendAdminPush(client, tenantId, candidate);
      sent += result.sent;
      failed += result.failed;
    } catch {
      failed += 1;
    }
  }
  return { candidates: limited.length, sent, failed, warnings };
}
