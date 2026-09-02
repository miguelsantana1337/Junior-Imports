import { describe, expect, it } from "vitest";
import {
  defaultPharmaceuticalStorefrontHost,
  isPharmaceuticalStorefrontHost,
  normalizeHostname,
} from "./pharmaceutical-storefront-host";

describe("host isolado do catálogo farmacêutico", () => {
  it("normaliza porta, caixa e ponto final", () => {
    expect(normalizeHostname("Farmaceuticos.JuniorImportsOficial.com.br.:443"))
      .toBe(defaultPharmaceuticalStorefrontHost);
  });

  it("não confunde a loja oficial de eletrônicos com o subdomínio", () => {
    expect(isPharmaceuticalStorefrontHost(defaultPharmaceuticalStorefrontHost)).toBe(true);
    expect(isPharmaceuticalStorefrontHost("junior-imports.vercel.app")).toBe(false);
    expect(isPharmaceuticalStorefrontHost("juniorimportsoficial.com.br")).toBe(false);
  });
});
