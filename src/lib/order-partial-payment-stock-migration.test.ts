import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608110001_partial_payment_commits_stock.sql"),
  "utf8",
);

describe("partial payment stock migration", () => {
  it("commits active reservations and records the sale movement", () => {
    expect(migration).toContain("commit_tenant_order_stock_on_payment");
    expect(migration).toContain("if v_reservation.status = 'active' then");
    expect(migration).toContain("set stock = stock - v_reservation.quantity");
    expect(migration).toContain("'sale-' || p_order_id || '-' || v_reservation.product_id");
    expect(migration).toContain("set status = 'committed'");
  });

  it("commits stock before deciding whether the payment completed the order", () => {
    const registerPayment = migration.slice(migration.indexOf("create or replace function public.register_tenant_order_payment"));
    const commitIndex = registerPayment.indexOf("select public.commit_tenant_order_stock_on_payment");
    const completionIndex = registerPayment.indexOf("if v_complete then");

    expect(commitIndex).toBeGreaterThan(-1);
    expect(completionIndex).toBeGreaterThan(commitIndex);
    expect(registerPayment).toContain("'stock_movements', v_stock_movements");
  });

  it("keeps reconciliation aligned with partial-payment stock commitment", () => {
    expect(migration).toContain("o.payment_status in ('Parcial', 'Recebido')");
    expect(migration).toContain("o.payment_status not in ('Parcial', 'Recebido')");
    expect(migration).toContain("v_order.payment_status in ('Parcial', 'Recebido')");
  });
});
