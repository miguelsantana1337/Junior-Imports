import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;
type Severity = "critical" | "high" | "medium" | "low";

type AlertInput = {
  fingerprint: string;
  source: string;
  severity: Severity;
  title: string;
  summary: string;
  details: Record<string, unknown>;
};

async function upsertAlert(client: AdminClient, tenantId: string, alert: AlertInput) {
  const now = new Date().toISOString();
  const { data: current } = await client.from("operational_alerts")
    .select("id,occurrence_count,status")
    .eq("tenant_id", tenantId)
    .eq("fingerprint", alert.fingerprint)
    .maybeSingle();
  const { data, error } = await client.from("operational_alerts").upsert({
    tenant_id: tenantId,
    fingerprint: alert.fingerprint,
    source: alert.source,
    severity: alert.severity,
    status: current?.status === "acknowledged" ? "acknowledged" : "open",
    title: alert.title,
    summary: alert.summary,
    details: alert.details,
    occurrence_count: Number(current?.occurrence_count ?? 0) + 1,
    first_seen_at: current ? undefined : now,
    last_seen_at: now,
    resolved_by: null,
    resolved_at: null,
    updated_at: now,
  }, { onConflict: "tenant_id,fingerprint" }).select("*").single();
  if (error) throw new Error(`Falha ao registrar alerta ${alert.fingerprint}.`);
  return data;
}

async function resolveAlert(client: AdminClient, tenantId: string, fingerprint: string) {
  const now = new Date().toISOString();
  await client.from("operational_alerts").update({ status: "resolved", resolved_at: now, updated_at: now })
    .eq("tenant_id", tenantId).eq("fingerprint", fingerprint).neq("status", "resolved");
}

async function deliverWebhook(client: AdminClient, tenantId: string, alert: Record<string, unknown>) {
  const destination = process.env.OPERATIONS_ALERT_WEBHOOK_URL;
  if (!destination) return;
  let destinationLabel = "Webhook operacional";
  try { destinationLabel = new URL(destination).hostname; } catch { /* label seguro */ }
  const payload = {
    event: "junior_imports.operational_alert",
    tenantId,
    alert: {
      id: alert.id,
      severity: alert.severity,
      title: alert.title,
      summary: alert.summary,
      source: alert.source,
      occurredAt: alert.last_seen_at,
    },
  };
  let status = "failed";
  let responseCode: number | null = null;
  let errorMessage = "";
  try {
    const response = await fetch(destination, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "JuniorImports-Continuity/1.0" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8_000),
    });
    responseCode = response.status;
    status = response.ok ? "delivered" : "failed";
    if (!response.ok) errorMessage = `HTTP ${response.status}`;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 300) : "Falha no webhook";
  }
  await client.from("operational_alert_deliveries").insert({
    tenant_id: tenantId,
    alert_id: alert.id,
    channel: "webhook",
    destination_label: destinationLabel,
    status,
    response_code: responseCode,
    error_message: errorMessage,
    delivered_at: status === "delivered" ? new Date().toISOString() : null,
  });
}

export async function runContinuityScan(client: AdminClient, tenantId: string) {
  await client.rpc("scan_operational_divergences", { p_tenant_id: tenantId });
  const cutoffBackup = new Date(Date.now() - 48 * 3_600_000).toISOString();
  const cutoffRecovery = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [divergences, backup, recovery] = await Promise.all([
    client.from("operational_divergences").select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId).in("status", ["open", "reopened"]).eq("severity", "critical"),
    client.from("backup_runs").select("id,status,created_at,verified_at").eq("tenant_id", tenantId)
      .in("status", ["completed", "verified"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("recovery_test_runs").select("id,status,finished_at,created_at").eq("tenant_id", tenantId)
      .eq("status", "passed").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const created: Record<string, unknown>[] = [];
  const criticalCount = divergences.count ?? 0;
  if (criticalCount > 0) {
    created.push(await upsertAlert(client, tenantId, {
      fingerprint: "critical-operational-divergences",
      source: "reconciliation",
      severity: "critical",
      title: "Divergências críticas exigem revisão",
      summary: `${criticalCount} divergência${criticalCount === 1 ? " crítica está" : "s críticas estão"} aberta${criticalCount === 1 ? "" : "s"}.`,
      details: { count: criticalCount },
    }));
  } else await resolveAlert(client, tenantId, "critical-operational-divergences");

  const backupAt = backup.data?.verified_at || backup.data?.created_at || "";
  if (!backupAt || backupAt < cutoffBackup) {
    created.push(await upsertAlert(client, tenantId, {
      fingerprint: "backup-stale-48h",
      source: "backup",
      severity: "high",
      title: "Backup administrativo desatualizado",
      summary: "Nenhum backup concluído e verificado foi encontrado nas últimas 48 horas.",
      details: { lastBackupAt: backupAt || null, thresholdHours: 48 },
    }));
  } else await resolveAlert(client, tenantId, "backup-stale-48h");

  const recoveryAt = recovery.data?.finished_at || recovery.data?.created_at || "";
  if (!recoveryAt || recoveryAt < cutoffRecovery) {
    created.push(await upsertAlert(client, tenantId, {
      fingerprint: "recovery-test-stale-30d",
      source: "recovery",
      severity: "medium",
      title: "Teste de restauração pendente",
      summary: "Não há teste de restauração aprovado nos últimos 30 dias.",
      details: { lastRecoveryTestAt: recoveryAt || null, thresholdDays: 30 },
    }));
  } else await resolveAlert(client, tenantId, "recovery-test-stale-30d");

  await Promise.all(created.filter((alert) => alert.severity === "critical" || alert.severity === "high")
    .map((alert) => deliverWebhook(client, tenantId, alert)));
  return { criticalDivergences: criticalCount, alertsRaised: created.length, scannedAt: new Date().toISOString() };
}
