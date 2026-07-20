import { describe, expect, it } from "vitest";
import { normalizePostalCode, parseViaCepAddress } from "./postal-code";

describe("consulta de CEP", () => {
  it("normaliza o CEP para oito dígitos", () => {
    expect(normalizePostalCode("01.001-000")).toBe("01001000");
  });

  it("converte a resposta do ViaCEP no endereço usado pelo checkout", () => {
    expect(parseViaCepAddress({
      logradouro: "Praça da Sé",
      bairro: "Sé",
      localidade: "São Paulo",
      uf: "sp",
    })).toEqual({ address: "Praça da Sé", district: "Sé", city: "São Paulo", state: "SP" });
  });

  it("rejeita CEP inexistente ou resposta sem cidade e estado", () => {
    expect(parseViaCepAddress({ erro: true })).toBeNull();
    expect(parseViaCepAddress({ logradouro: "Rua sem cidade" })).toBeNull();
  });
});
