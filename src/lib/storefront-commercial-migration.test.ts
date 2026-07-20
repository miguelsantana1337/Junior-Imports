import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607180009_storefront_commercial_readiness.sql"),
  "utf8",
);

describe("migração de prontidão comercial da vitrine", () => {
  it("ativa o checkout por WhatsApp e restaura o FAQ de compra", () => {
    expect(migration).toContain("checkout_mode = 'whatsapp'");
    expect(migration).toContain("'block-home-faq'");
    expect(migration).toContain("'Como faço uma compra?'");
    expect(migration).toContain("'Como será feito o pagamento?'");
  });

  it("não substitui o número configurado pelo administrador", () => {
    expect(migration).not.toMatch(/set[\s\S]{0,300}\bwhatsapp\s*=/i);
  });
});
