import { describe, expect, it } from "vitest";
import { normalizeClientId, normalizeOrderPrefix } from "./platform";

describe("configuração white-label", () => {
  it("gera uma chave segura e estável para isolar dados do cliente", () => {
    expect(normalizeClientId("Loja São José & Filhos")).toBe(
      "loja-sao-jose-filhos",
    );
  });

  it("limita o prefixo de pedidos a letras e números", () => {
    expect(normalizeOrderPrefix(" lj-2026 ")).toBe("LJ202");
    expect(normalizeOrderPrefix("---")).toBe("LOJA");
  });
});
