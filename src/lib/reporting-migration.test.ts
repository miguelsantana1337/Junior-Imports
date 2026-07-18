import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202607180005_analytics_reports_exports.sql", "utf8");

describe("migration do Lote 5", () => {
  it("protege relatórios e exportações por tenant e permissão", () => {
    expect(sql).toContain("alter table public.saved_reports enable row level security");
    expect(sql).toContain("alter table public.export_runs enable row level security");
    expect(sql).toContain("has_tenant_permission(tenant_id, 'reports')");
    expect(sql).toContain("revoke all on public.saved_reports from anon");
    expect(sql).toContain("revoke all on public.export_runs from anon");
  });

  it("mantém trilha auditável e valida os formatos exportados", () => {
    expect(sql).toContain("format in ('csv', 'xlsx', 'pdf')");
    expect(sql.match(/execute function public\.capture_admin_audit\(\)/g)).toHaveLength(2);
    expect(sql).toContain("'reports'");
  });
});
