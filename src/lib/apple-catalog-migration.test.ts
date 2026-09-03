import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202609020001_apple_catalog_usd_pricing.sql"),
  "utf8",
);

describe("catálogo Apple sob encomenda", () => {
  it("cadastra os 26 preços mínimos aprovados com a referência cambial de 02/09", () => {
    expect(migration.match(/^\s*\(\d+, '.*', '.*', \d+(?:\.\d+)?, 'https:/gm)).toHaveLength(26);
    expect(migration).toContain("5.127300");
    expect(migration).toContain("date '2026-09-02'");
    expect(migration).toContain("(1, 'iphone-15-128gb', 'iPhone 15 128GB', 2930.00");
    expect(migration).toContain("(26, 'airtag-4-pack', 'AirTag 4 Pack', 1100.00");
  });

  it("não cria estoque fictício nem reserva saldo em produtos sob encomenda", () => {
    expect(migration).toContain("made_to_order boolean not null default false");
    expect(migration).toContain("if not coalesce(v_product.made_to_order, false) then");
    expect(migration).toContain("case when made_to_order then 10 else least(10, quantity) end");
  });

  it("recalcula somente preços vinculados e restringe a atualização ao service role", () => {
    expect(migration).toContain("where currency_pricing_enabled = true");
    expect(migration).toContain("price = round(currency_base_price * p_rate / currency_base_rate, 2)");
    expect(migration).toContain("if auth.role() <> 'service_role'");
  });
});
