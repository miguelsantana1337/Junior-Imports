import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607180001_backup_runs_health.sql"),
  "utf8",
);

describe("histórico protegido de backups", () => {
  it("mantém escrita fora do cliente e leitura limitada por tenant", () => {
    expect(migration).toContain("alter table public.backup_runs enable row level security");
    expect(migration).toContain("public.has_tenant_permission(tenant_id, 'data')");
    expect(migration).toContain("revoke all on table public.backup_runs from anon, authenticated");
    expect(migration).toContain("grant select on table public.backup_runs to authenticated");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*to\s+authenticated/i);
  });
});
