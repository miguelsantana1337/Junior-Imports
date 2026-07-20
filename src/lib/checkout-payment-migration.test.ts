import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("migração das formas de pagamento", () => {
  const migration = readFileSync(
    join(process.cwd(), "supabase/migrations/202607180010_checkout_address_and_payment.sql"),
    "utf8",
  );

  it("aceita dinheiro e preserva boleto somente para pedidos históricos", () => {
    expect(migration).toContain("payment in ('Pix', 'Cartao', 'Dinheiro', 'Boleto')");
    expect(migration).toContain("p_payment not in (''Pix'', ''Cartao'', ''Dinheiro'', ''Boleto'')");
    expect(migration).toContain("create_tenant_order_secure");
  });
});
