"use client";

import { Activity, CheckCircle2, Clock3, Database, HardDrive, RefreshCw, ServerCog, ShieldCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";
import type { AdminHealthCheck, AdminHealthReport, HealthStatus } from "@/lib/admin-health";

const statusLabel: Record<HealthStatus, string> = { healthy: "Operacional", warning: "Atenção", critical: "Crítico", unknown: "Não verificado" };
const iconByCheck: Record<AdminHealthCheck["id"], typeof Database> = { database: Database, authentication: ShieldCheck, audit: Activity, backup: HardDrive, deployment: ServerCog };

export function AdminHealthCenter() {
  const [report, setReport] = useState<AdminHealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/health", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("health request failed");
      setReport(await response.json() as AdminHealthReport);
    } catch {
      setError("Não foi possível atualizar o diagnóstico agora.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const backupComplete = () => void refresh();
    window.addEventListener("admin:backup-complete", backupComplete);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("admin:backup-complete", backupComplete);
    };
  }, [refresh]);

  return (
    <section className="admin-health-center" aria-labelledby="admin-health-title">
      <header>
        <div className={`admin-health-orb ${report?.status ?? "unknown"}`}>{report?.status === "healthy" ? <CheckCircle2 /> : <TriangleAlert />}</div>
        <div><span>MONITORAMENTO OPERACIONAL</span><h2 id="admin-health-title">Central de saúde</h2><p>{report ? `Estado geral: ${statusLabel[report.status]}` : "Verificando os serviços críticos..."}</p></div>
        <button className="admin-button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "is-spinning" : ""} /> {loading ? "Verificando..." : "Verificar agora"}</button>
      </header>
      {error && <p className="admin-health-error" role="alert">{error}</p>}
      <div className="admin-health-grid">
        {(report?.checks ?? []).map((check) => {
          const Icon = iconByCheck[check.id];
          return <article className={check.status} key={check.id}><div className="admin-health-icon"><Icon /></div><div><span>{check.title}</span><strong>{check.summary}</strong><p>{check.detail}</p><footer><b>{statusLabel[check.status]}</b>{typeof check.latencyMs === "number" && <small>{check.latencyMs} ms</small>}{check.observedAt && <small><Clock3 /> {formatDateTime(check.observedAt)}</small>}</footer></div></article>;
        })}
        {!report && !error && Array.from({ length: 5 }, (_, index) => <article className="admin-health-skeleton" key={index}><i /><div><i /><i /><i /></div></article>)}
      </div>
      {report && <footer className="admin-health-meta"><span><Clock3 /> Atualizado em {formatDateTime(report.checkedAt)}</span><span>Ambiente: {report.environment}</span><span>Commit: {report.commitSha}</span></footer>}
    </section>
  );
}
