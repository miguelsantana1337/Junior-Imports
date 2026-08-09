import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608090002_fix_partial_payment_order_timestamp.sql"),
  "utf8",
).toLowerCase();

describe("reparo da RPC de pagamentos parciais", () => {
  it("não tenta atualizar uma coluna inexistente em orders", () => {
    const orderUpdate = migration.slice(
      migration.indexOf("update public.orders"),
      migration.indexOf("return jsonb_build_object"),
    );
    expect(orderUpdate).not.toContain("updated_at");
    expect(orderUpdate).toContain("amount_paid = v_next_paid");
    expect(orderUpdate).toContain("lifecycle_version = lifecycle_version + 1");
  });

  it("mantém a RPC restrita a usuários autenticados", () => {
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
