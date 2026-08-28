import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608280003_september_cashback_one_percent.sql"),
  "utf8",
);
const publicReadMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608280004_public_active_cashback_campaigns.sql"),
  "utf8",
);

describe("cashback de setembro", () => {
  it("aceita percentual direto de 1% no banco", () => {
    expect(migration).toContain("multiplier >= 0.1 and multiplier <= 100");
    expect(migration).toContain("'cashback-september-2026'");
    expect(migration).toContain("'Cashback 1% — Setembro'");
    expect(migration).toMatch(/\n\s*1,\n\s*0,\n\s*90,/);
  });

  it("limita a campanha a setembro e evita retroatividade", () => {
    expect(migration).toContain("'2026-09-01 00:00:00-03'");
    expect(migration).toContain("'2026-10-01 00:00:00-03'");
    expect(migration).toContain("orders.created_at");
  });

  it("passa pelo Guardião antes da ativação", () => {
    expect(migration).toContain("campaign_financial_simulations");
    expect(migration).toContain("worst_margin_product");
    expect(migration).toContain("product.margin_amount >= 0");
    expect(migration).toContain("set status = 'active'");
  });

  it("documenta a base líquida e exclui o frete", () => {
    expect(migration).toContain("valor efetivamente pago pelos produtos após a promoção");
    expect(migration).toContain("sem incluir o frete");
  });

  it("expõe somente campanhas ativas para o cálculo da vitrine", () => {
    expect(publicReadMigration).toContain('policy "public active cashback campaigns"');
    expect(publicReadMigration).toContain("status = 'active'");
    expect(publicReadMigration).toContain("public.is_public_tenant(tenant_id)");
    expect(publicReadMigration).toContain("grant select on table public.cashback_campaigns to anon, authenticated");
  });
});
