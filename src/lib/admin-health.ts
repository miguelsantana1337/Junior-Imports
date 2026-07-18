export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export interface AdminHealthCheck {
  id: "database" | "authentication" | "audit" | "backup" | "deployment";
  title: string;
  status: HealthStatus;
  summary: string;
  detail: string;
  latencyMs?: number;
  observedAt?: string;
}

export interface AdminHealthReport {
  status: HealthStatus;
  checkedAt: string;
  environment: "local" | "preview" | "production";
  deploymentId: string;
  commitSha: string;
  checks: AdminHealthCheck[];
}

const statusWeight: Record<HealthStatus, number> = { healthy: 0, unknown: 1, warning: 2, critical: 3 };

export function deriveHealthStatus(checks: Array<Pick<AdminHealthCheck, "status">>): HealthStatus {
  return checks.reduce<HealthStatus>((current, check) => statusWeight[check.status] > statusWeight[current] ? check.status : current, "healthy");
}

export function backupFreshness(createdAt: string | null, now = Date.now()): HealthStatus {
  if (!createdAt) return "critical";
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return "critical";
  const ageHours = (now - timestamp) / 3_600_000;
  if (ageHours <= 24) return "healthy";
  if (ageHours <= 72) return "warning";
  return "critical";
}

export function healthEnvironment(value: string | undefined): AdminHealthReport["environment"] {
  if (value === "production") return "production";
  if (value === "preview") return "preview";
  return "local";
}
