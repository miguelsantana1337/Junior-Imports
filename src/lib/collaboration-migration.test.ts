import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync("supabase/migrations/202607180006_team_collaboration_copilot.sql", "utf8");

describe("migration do Lote 6", () => {
  it("isola colaboração, presença e uso do Copiloto por tenant", () => {
    expect(sql).toContain("alter table public.collaboration_threads enable row level security");
    expect(sql).toContain("alter table public.team_presence enable row level security");
    expect(sql).toContain("alter table public.copilot_usage enable row level security");
    expect(sql).toContain("has_tenant_permission(tenant_id, 'collaboration')");
    expect(sql).toContain("has_tenant_permission(tenant_id, 'copilot')");
    expect(sql).toContain("revoke all on public.collaboration_threads");
  });

  it("limita escrita de presença e travas a funções autenticadas", () => {
    expect(sql).toContain("auth.uid() is null");
    expect(sql).toContain("grant select on public.team_presence, public.entity_edit_locks");
    expect(sql).toContain("acquire_entity_edit_lock");
    expect(sql).toContain("lease_expires_at");
  });

  it("mantém o Copiloto sem ações e sem custo externo por padrão", () => {
    expect(sql).toContain("mode text not null default 'local'");
    expect(sql).toContain("input_tokens integer not null default 0");
    expect(sql).toContain("output_tokens integer not null default 0");
  });
});
