import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202609010001_delay_september_campaign.sql"),
  "utf8",
);

describe("adiamento da campanha de setembro", () => {
  it("inicia promoção e cashback em 07/09/2026", () => {
    expect(migration).toContain("'2026-09-07 00:00:00-03'");
    expect(migration).toContain("promotion_starts_at");
    expect(migration).toContain("cashback-september-2026");
    expect(migration).toContain("starts_at");
  });

  it("não regrava pedidos existentes", () => {
    expect(migration).not.toMatch(/update\s+public\.orders/i);
    expect(migration).not.toMatch(/delete\s+from\s+public\.orders/i);
  });

  it("publica uma nova revisão somente após a aprovação do Guardião", () => {
    expect(migration).toContain("status = 'draft'");
    expect(migration).toContain("campaign_financial_simulations");
    expect(migration).toContain("campaign.published_revision");
    expect(migration).toContain("simulation.decision = 'approved'");
    expect(migration).toContain("status = 'active'");
  });
});
