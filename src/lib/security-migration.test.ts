import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607160005_p0_security_hardening.sql"),
  "utf8",
).toLowerCase();

describe("matriz de privilégios da migration P0", () => {
  it("remove RPCs legadas e fecha execução presente e futura por padrão", () => {
    expect(migration).toContain("drop function if exists public.create_demo_order");
    expect(migration).toContain("drop function if exists public.create_tenant_order");
    expect(migration).toContain("drop function if exists public.update_demo_order_status");
    expect(migration).toContain("revoke execute on all functions in schema public from public, anon, authenticated");
    expect(migration).toContain("alter default privileges in schema public revoke execute on functions from public, anon, authenticated");
  });

  it("concede checkout seguro somente ao service role", () => {
    expect(migration).toContain(
      "grant execute on function public.create_tenant_order_secure(uuid, jsonb, jsonb, text, text, uuid, text, text, text, integer) to service_role",
    );
    expect(migration).not.toMatch(/grant execute on function public\.create_tenant_order_secure\([^;]+to (anon|authenticated|public)/);
  });

  it("redige os snapshots sensíveis da auditoria", () => {
    const auditStart = migration.indexOf("create or replace function public.audit_safe_snapshot");
    const auditEnd = migration.indexOf("create or replace function public.capture_admin_audit");
    const auditSnapshot = migration.slice(auditStart, auditEnd);

    expect(auditSnapshot).not.toContain("p_row->'phone'");
    expect(auditSnapshot).not.toContain("p_row->'email'");
    expect(auditSnapshot).not.toContain("p_row->'address'");
    expect(auditSnapshot).not.toContain("p_row->'notes'");
  });
});
