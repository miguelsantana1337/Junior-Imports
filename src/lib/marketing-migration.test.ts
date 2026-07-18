import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202607180003_marketing_workflow_automation.sql"), "utf8");
const publicSchedule = readFileSync(resolve(process.cwd(), "supabase/migrations/202607180004_public_marketing_schedule.sql"), "utf8");

describe("workflow seguro de marketing", () => {
  it("mantém mutações editoriais atrás de RPCs com permissão", () => {
    expect(migration).toContain("has_tenant_permission(p_tenant_id, 'marketing')");
    expect(migration).toContain("revoke all on table public.marketing_publications");
    expect(migration).toContain("grant select on table public.marketing_publications");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*marketing_publications[^;]*authenticated/i);
  });

  it("registra versões, transições e rollback", () => {
    expect(migration).toContain("create table if not exists public.marketing_publication_versions");
    expect(migration).toContain("create or replace function public.transition_marketing_publication");
    expect(migration).toContain("create or replace function public.rollback_marketing_publication");
    expect(migration).toContain("Transição de publicação inválida");
  });

  it("registra teste, retry e execução automática", () => {
    expect(migration).toContain("create table if not exists public.automation_runs");
    expect(migration).toContain("create or replace function public.test_message_automation");
    expect(migration).toContain("create or replace function public.retry_automation_run");
    expect(migration).toContain("workflow_status = 'active'");
  });

  it("processa somente agendas já aprovadas na leitura pública", () => {
    expect(publicSchedule).toContain("public.is_public_tenant(p_tenant_id)");
    expect(publicSchedule).toContain("status = 'scheduled' and starts_at <= now()");
    expect(publicSchedule).toContain("grant execute on function public.process_public_marketing_schedule(uuid) to anon, authenticated");
    expect(publicSchedule).not.toContain("has_tenant_permission");
  });
});
