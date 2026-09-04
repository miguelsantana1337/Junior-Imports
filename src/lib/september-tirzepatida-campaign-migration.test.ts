import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202609030002_expand_september_tirzepatida_campaign.sql"),
  "utf8",
);

describe("ampliação da campanha para todas as tirzepatidas", () => {
  it("restringe o cashback aos 27 produtos ativos da categoria Tirzepatidas", () => {
    expect(migration).toContain("category.slug = 'tirzepatidas'");
    expect(migration).toContain("if v_product_count <> 27");
    expect(migration).toContain("product_ids = v_product_ids");
    expect(migration).toContain("category_ids = array[v_category_id]::text[]");
  });

  it("configura oito ampolas e oito pares de caixa com brinde da mesma marca", () => {
    expect(migration).toContain("'singleProductIds', v_single_ids");
    expect(migration).toContain("'boxProductMappings', v_box_mappings");
    expect(migration).toContain("jsonb_array_elements_text(v_single_ids)");
    expect(migration).toContain("jsonb_array_elements(v_box_mappings)");
    expect(migration).toContain("'mixBrandsForGroup', false");
  });

  it("mantém pedidos anteriores e a data original de início intactos", () => {
    const dataChange = migration.slice(migration.indexOf("\ndo $$"));
    expect(dataChange.length).toBeGreaterThan(1_000);
    expect(dataChange).not.toMatch(/update\s+public\.orders/i);
    expect(dataChange).not.toMatch(/delete\s+from\s+public\.orders/i);
    expect(dataChange).not.toMatch(/\bstarts_at\s*=/i);
    expect(dataChange).not.toMatch(/promotion_starts_at\s*=/i);
  });

  it("aprova cashback, dose brinde, trio com desconto e caixa com brinde", () => {
    expect(migration).toContain("'cashback'::text as scenario_kind");
    expect(migration).toContain("'single-dose-gift'");
    expect(migration).toContain("'three-single-fifty-percent'");
    expect(migration).toContain("'box-same-brand-gift'");
    expect(migration).toContain("v_product_count + 24");
    expect(migration).toContain("scenario.margin_amount >= 0");
    expect(migration).toContain("v_campaign.guardian_status <> 'approved'");
  });

  it("publica textos que deixam explícita a exigência de mesma marca", () => {
    expect(migration).toContain("3 ampolas de tirzepatida 15 mg da mesma marca");
    expect(migration).toContain("1 ampola da mesma marca");
    expect(migration).toContain("Ver tirzepatidas");
  });
});
