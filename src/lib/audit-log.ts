import type { AuditLog } from "@/types/store";

const protectedAuditField = /password|token|secret|credential|recovery|mfa|encrypted|service.?role|api.?key/i;
const ignoredAuditField = /^(tenant_id|updated_at)$/i;

function auditValue(key: string, value: unknown) {
  if (protectedAuditField.test(key)) return "[valor protegido]";
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") {
    const serialized = JSON.stringify(value);
    return serialized.length > 180 ? `${serialized.slice(0, 177)}...` : serialized;
  }
  const serialized = String(value);
  return serialized.length > 180 ? `${serialized.slice(0, 177)}...` : serialized;
}

export function auditChanges(log: Pick<AuditLog, "beforeData" | "afterData">) {
  const before = log.beforeData ?? {};
  const after = log.afterData ?? {};
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter((key) => !ignoredAuditField.test(key))
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, before: auditValue(key, before[key]), after: auditValue(key, after[key]) }));
}
