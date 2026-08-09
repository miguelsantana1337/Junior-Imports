import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608080004_order_partial_payments.sql"),
  "utf8",
);

describe("migração de pagamentos parciais", () => {
  it("guarda o valor recebido e valida os três estados financeiros", () => {
    expect(migration).toContain("amount_paid numeric(12,2) not null default 0");
    expect(migration).toContain("payment_status = 'Recebido' and amount_paid = coalesce(financial_total, total)");
    expect(migration).toContain("payment_status = 'Parcial' and amount_paid > 0");
    expect(migration).toContain("payment_status = 'Pendente' and amount_paid = 0");
  });

  it("registra cada parcela com trava e controle de concorrência", () => {
    expect(migration).toContain("register_tenant_order_payment");
    expect(migration).toContain("for update");
    expect(migration).toContain("p_expected_version");
    expect(migration).toContain("'order-payment:' || p_order_id");
  });

  it("só conclui o pedido quando o saldo zera e evita receita duplicada", () => {
    expect(migration).toContain("v_complete := v_next_paid = v_total");
    expect(migration).toContain("perform public.update_tenant_order_status");
    expect(migration).toContain("external_key = 'order-income:' || p_order_id");
    expect(migration).toContain("set status = 'cancelled'");
  });

  it("protege parcelas de visitantes e de ajustes abaixo do recebido", () => {
    expect(migration).toContain("has_tenant_permission(p_tenant_id, 'finance')");
    expect(migration).toContain("O novo total nao pode ser menor que o valor ja recebido");
    expect(migration).toContain("revoke all on function public.register_tenant_order_payment");
    expect(migration).not.toMatch(/grant execute on function public\.register_tenant_order_payment\([^;]+to (anon|public)/);
  });
});
