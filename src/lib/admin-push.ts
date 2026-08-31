import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import webPush from "web-push";
import type { AdminNotificationCategory } from "@/lib/admin-preferences";

export type AdminPushPayload = {
  notificationKey: string;
  category: AdminNotificationCategory;
  title: string;
  body: string;
  href: string;
  priority?: "critical" | "important" | "info";
};

type PushSubscriptionRow = {
  id: string;
  tenant_id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth_secret: string;
  categories: string[] | null;
  failure_count: number | null;
};

type PushError = Error & { statusCode?: number; body?: string };

let configuredFingerprint = "";

function pushConfiguration() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim()
    || process.env.NEXT_PUBLIC_SITE_URL?.trim()
    || "https://junior-imports.vercel.app";
  return { publicKey, privateKey, subject, configured: Boolean(publicKey && privateKey && subject) };
}

export function getAdminPushPublicConfiguration() {
  const config = pushConfiguration();
  return { configured: config.configured, publicKey: config.configured ? config.publicKey : "" };
}

function configureWebPush() {
  const config = pushConfiguration();
  if (!config.configured) return false;
  const fingerprint = createHash("sha256")
    .update(`${config.subject}:${config.publicKey}:${config.privateKey}`)
    .digest("hex");
  if (configuredFingerprint !== fingerprint) {
    webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
    configuredFingerprint = fingerprint;
  }
  return true;
}

function safeHref(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("//")) return "/admin";
  return value.slice(0, 500);
}

function compactError(error: unknown) {
  if (!(error instanceof Error)) return "Falha desconhecida no serviço de push.";
  return error.message.replace(/\s+/g, " ").slice(0, 500);
}

function topicFor(notificationKey: string) {
  return createHash("sha256").update(notificationKey).digest("base64url").slice(0, 32);
}

async function activeAdminUserIds(client: SupabaseClient, tenantId: string) {
  const [{ data: members, error: memberError }, { data: platformAdmins, error: profileError }] = await Promise.all([
    client.from("tenant_members").select("user_id").eq("tenant_id", tenantId).eq("active", true),
    client.from("profiles").select("id").eq("active", true).eq("is_platform_admin", true),
  ]);
  if (memberError) throw memberError;
  const ids = new Set((members ?? []).map((row) => String(row.user_id)));
  if (!profileError) for (const row of platformAdmins ?? []) ids.add(String(row.id));
  return ids;
}

async function claimDelivery(
  client: SupabaseClient,
  subscription: PushSubscriptionRow,
  payload: AdminPushPayload,
) {
  const row = {
    tenant_id: subscription.tenant_id,
    user_id: subscription.user_id,
    subscription_id: subscription.id,
    notification_key: payload.notificationKey.slice(0, 240),
    category: payload.category,
    status: "queued",
  };
  const inserted = await client.from("admin_push_deliveries").insert(row).select("id").maybeSingle();
  if (!inserted.error && inserted.data) return String(inserted.data.id);
  if (inserted.error?.code !== "23505") throw inserted.error;

  const existing = await client.from("admin_push_deliveries")
    .select("id, status, created_at")
    .eq("subscription_id", subscription.id)
    .eq("notification_key", row.notification_key)
    .maybeSingle();
  if (existing.error || !existing.data || existing.data.status !== "failed") return null;
  const lastAttempt = new Date(String(existing.data.created_at)).getTime();
  if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < 2 * 60_000) return null;
  const reclaimed = await client.from("admin_push_deliveries")
    .update({ status: "queued", response_code: null, error_message: "", delivered_at: null })
    .eq("id", existing.data.id)
    .eq("status", "failed")
    .select("id")
    .maybeSingle();
  return reclaimed.data ? String(reclaimed.data.id) : null;
}

export async function sendAdminPush(
  client: SupabaseClient,
  tenantId: string,
  payload: AdminPushPayload,
  options: { targetUserId?: string } = {},
) {
  if (!configureWebPush()) return { configured: false, attempted: 0, sent: 0, failed: 0 };

  let query = client.from("admin_push_subscriptions")
    .select("id, tenant_id, user_id, endpoint, p256dh, auth_secret, categories, failure_count")
    .eq("tenant_id", tenantId)
    .eq("active", true);
  if (options.targetUserId) query = query.eq("user_id", options.targetUserId);
  const { data, error } = await query;
  if (error) throw error;

  const validUsers = await activeAdminUserIds(client, tenantId);
  const subscriptions = (data ?? [])
    .map((row) => row as PushSubscriptionRow)
    .filter((subscription) => validUsers.has(subscription.user_id))
    .filter((subscription) => (subscription.categories ?? []).includes(payload.category));
  const result = { configured: true, attempted: subscriptions.length, sent: 0, failed: 0 };
  const body = JSON.stringify({
    title: payload.title.slice(0, 100),
    body: payload.body.slice(0, 240),
    href: safeHref(payload.href),
    category: payload.category,
    priority: payload.priority ?? "important",
    notificationKey: payload.notificationKey.slice(0, 240),
    icon: "/pwa/admin-icon-192.png",
    badge: "/pwa/admin-icon-192.png",
  });

  await Promise.all(subscriptions.map(async (subscription) => {
    let deliveryId: string | null = null;
    try {
      deliveryId = await claimDelivery(client, subscription, payload);
      if (!deliveryId) return;
      const response = await webPush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
      }, body, {
        TTL: payload.priority === "critical" ? 86_400 : 14_400,
        urgency: payload.priority === "critical" ? "high" : payload.priority === "info" ? "low" : "normal",
        topic: topicFor(payload.notificationKey),
      });
      const deliveredAt = new Date().toISOString();
      await Promise.all([
        client.from("admin_push_deliveries").update({ status: "sent", response_code: response.statusCode, delivered_at: deliveredAt, error_message: "" }).eq("id", deliveryId),
        client.from("admin_push_subscriptions").update({ last_success_at: deliveredAt, failure_count: 0 }).eq("id", subscription.id),
      ]);
      result.sent += 1;
    } catch (caught) {
      result.failed += 1;
      const pushError = caught as PushError;
      const responseCode = Number(pushError.statusCode) || null;
      const expired = responseCode === 404 || responseCode === 410;
      const failureCount = (subscription.failure_count ?? 0) + 1;
      const failedAt = new Date().toISOString();
      await Promise.all([
        deliveryId ? client.from("admin_push_deliveries").update({
          status: expired ? "expired" : "failed",
          response_code: responseCode,
          error_message: compactError(caught),
        }).eq("id", deliveryId) : Promise.resolve(),
        client.from("admin_push_subscriptions").update({
          active: !(expired || failureCount >= 5),
          last_failure_at: failedAt,
          failure_count: failureCount,
        }).eq("id", subscription.id),
      ]);
    }
  }));

  return result;
}
