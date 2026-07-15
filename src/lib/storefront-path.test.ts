import { describe, expect, it } from "vitest";
import { withStorefrontPath } from "./storefront-path";

describe("rotas públicas multi-tenant", () => {
  it("mantém a loja raiz e prefixa a prévia por cliente", () => {
    expect(withStorefrontPath("", "/produtos/item")).toBe("/produtos/item");
    expect(withStorefrontPath("/loja/autentica", "/produtos/item")).toBe("/loja/autentica/produtos/item");
    expect(withStorefrontPath("/loja/autentica", "/#catalogo")).toBe("/loja/autentica#catalogo");
  });
});
