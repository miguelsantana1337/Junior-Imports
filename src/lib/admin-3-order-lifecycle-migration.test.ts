import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/202608080001_admin_3_order_lifecycle.sql"), "utf8");

describe("migração do ciclo de pedidos do ADMIN 3.0", () => {
  it("separa operação, pagamento e versão de concorrência", () => {
    expect(migration).toContain("operational_status text not null default 'Novo'");
    expect(migration).toContain("payment_status text not null default 'Pendente'");
    expect(migration).toContain("lifecycle_version integer not null default 1");
  });

  it("usa função fechada, trava a linha e impede atualização concorrente", () => {
    expect(migration).toContain("update_tenant_order_lifecycle");
    expect(migration).toContain("for update");
    expect(migration).toContain("p_expected_version");
    expect(migration).toContain("Este pedido foi alterado em outra tela");
  });

  it("preserva as rotinas existentes e exige permissão financeira", () => {
    expect(migration).toContain("perform public.update_tenant_order_status");
    expect(migration).toContain("has_tenant_permission(p_tenant_id, 'finance')");
    expect(migration).toContain("archive_after := now() + interval '7 days'");
  });

  it("não expõe a função a visitantes", () => {
    expect(migration).toContain("revoke all on function public.update_tenant_order_lifecycle");
    expect(migration).not.toMatch(/grant execute on function public\.update_tenant_order_lifecycle\([^;]+to (anon|public)/);
  });
});
