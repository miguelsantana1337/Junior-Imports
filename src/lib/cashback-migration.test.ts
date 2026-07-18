import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607180002_cashback_wallet_customer360.sql"),
  "utf8",
);

describe("ledger seguro de cashback", () => {
  it("impede alteração e exclusão dos lançamentos", () => {
    expect(migration).toContain("before update or delete on public.cashback_entries");
    expect(migration).toContain("before update or delete on public.cashback_allocations");
    expect(migration).toContain("O ledger de cashback é imutável");
    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*cashback_entries[^;]*authenticated/i);
  });

  it("faz ajustes somente por RPC autorizada e auditada", () => {
    expect(migration).toContain("public.has_tenant_permission(p_tenant_id, 'customers')");
    expect(migration).toContain("Saldo de cashback insuficiente");
    expect(migration).toContain("insert into public.audit_logs");
    expect(migration).toContain("grant execute on function public.adjust_customer_cashback");
  });

  it("conecta confirmação e cancelamento do pedido ao extrato", () => {
    expect(migration).toContain("after insert or update of status, cashback_total on public.orders");
    expect(migration).toContain("'order_credit'");
    expect(migration).toContain("'campaign_bonus'");
    expect(migration).toContain("'order_reversal'");
  });

  it("isola campanhas e extrato por tenant", () => {
    expect(migration).toContain("alter table public.cashback_campaigns enable row level security");
    expect(migration).toContain("alter table public.cashback_entries enable row level security");
    expect(migration).toContain("public.has_tenant_permission(tenant_id, 'customers')");
    expect(migration).toContain("security_invoker = true");
  });
});
