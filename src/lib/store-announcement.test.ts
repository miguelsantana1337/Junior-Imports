import { describe, expect, it } from "vitest";
import { resolveStoreAnnouncement } from "./store-announcement";

const baseSettings = {
  announcement: "Compre hoje e receba cashback",
  freeShippingEnabled: false,
  freeShippingThreshold: 499,
  shippingCityRates: [
    { city: "Ipatinga", state: "MG", amount: 10 },
    { city: "Timóteo", state: "MG", amount: 30 },
  ],
};

describe("barra de anúncio da loja", () => {
  const regularSpaces = (value: string) => value.replaceAll("\u00a0", " ");

  it("respeita o texto personalizado mesmo com o frete grátis desligado", () => {
    expect(resolveStoreAnnouncement(baseSettings)).toBe("Compre hoje e receba cashback");
  });

  it("substitui as variáveis de frete disponíveis no editor", () => {
    expect(regularSpaces(resolveStoreAnnouncement({
      ...baseSettings,
      announcement: "Frete local desde {{frete}} e grátis acima de {{valor}}",
    }))).toBe("Frete local desde R$ 10,00 e grátis acima de R$ 499,00");
  });

  it("mantém a mensagem automática para a configuração antiga", () => {
    expect(regularSpaces(resolveStoreAnnouncement({
      ...baseSettings,
      announcement: "Frete grátis em compras acima de {{valor}}",
    }))).toBe("Frete local a partir de R$ 10,00 · Demais cidades sob cotação");
  });
});
