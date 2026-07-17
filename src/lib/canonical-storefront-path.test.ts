import { describe, expect, it } from "vitest";
import { getPrimaryStorefrontRedirectPath } from "./canonical-storefront-path";

describe("URL canônica da loja principal", () => {
  it("redireciona a vitrine duplicada para a raiz", () => {
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/junior-imports",
        "junior-imports",
      ),
    ).toBe("/");
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/junior-imports/",
        "junior-imports",
      ),
    ).toBe("/");
  });

  it("preserva o restante do caminho em produtos, checkout e pedidos", () => {
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/junior-imports/produtos/lipoless-md",
        "junior-imports",
      ),
    ).toBe("/produtos/lipoless-md");
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/junior-imports/checkout",
        "junior-imports",
      ),
    ).toBe("/checkout");
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/junior-imports/pedidos/JI-1006",
        "junior-imports",
      ),
    ).toBe("/pedidos/JI-1006");
  });

  it("mantém disponíveis as rotas de outros tenants", () => {
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/outra-loja",
        "junior-imports",
      ),
    ).toBeNull();
    expect(
      getPrimaryStorefrontRedirectPath(
        "/loja/junior-imports-atacado",
        "junior-imports",
      ),
    ).toBeNull();
  });
});
