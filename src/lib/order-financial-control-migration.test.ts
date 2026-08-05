import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608050001_order_financial_control.sql"),
  "utf8",
);

describe("migração de controle financeiro dos pedidos", () => {
  it("separa o total comercial do valor financeiro", () => {
    expect(migration).toContain("financial_total numeric(12,2)");
    expect(migration).toContain("financial_adjustment numeric(12,2)");
    expect(migration).toContain("new.financial_total := new.total");
  });

  it("exige permissões de pedidos e financeiro para ajustes", () => {
    expect(migration).toContain("public.has_tenant_permission(p_tenant_id, 'orders')");
    expect(migration).toContain("public.has_tenant_permission(p_tenant_id, 'finance')");
    expect(migration).toContain("adjust_tenant_order_financial_total");
    expect(migration).toContain("protect_order_control_fields");
    expect(migration).toContain("Acesso negado ao ajuste financeiro");
  });

  it("mantém arquivamento reversível e bloqueia pedidos abertos", () => {
    expect(migration).toContain("set_tenant_order_archived");
    expect(migration).toContain("v_order.status not in ('Entregue', 'Cancelado')");
    expect(migration).not.toMatch(/delete\s+from\s+public\.orders/i);
  });

  it("corrige a confirmação direta como entregue", () => {
    expect(migration).toContain("p_status in (''Pago'', ''Entregue'') and v_order.status not in (''Pago'', ''Entregue'')");
    expect(migration).toContain("coalesce(v_order.financial_total, v_order.total)");
  });

  it("expõe somente RPCs autenticadas", () => {
    expect(migration).toContain("revoke all on function public.adjust_tenant_order_financial_total");
    expect(migration).toContain("grant execute on function public.adjust_tenant_order_financial_total");
    expect(migration).toContain("to authenticated");
  });
});
