import { describe, expect, it } from "vitest";
import { hasAllowedStorefrontSource } from "./storefront-request-origin";

function request(headers: Record<string, string>) {
  return new Request("https://junior-imports.vercel.app/api/storefront/referrals", { headers });
}

describe("guardStorefrontRequest", () => {
  it("aceita uma solicitação com Origin da própria loja", () => {
    expect(hasAllowedStorefrontSource(request({
      origin: "https://junior-imports.vercel.app",
      "sec-fetch-site": "same-origin",
    }))).toBe(true);
  });

  it("aceita GET do navegador com Referer da própria loja e sem Origin", () => {
    expect(hasAllowedStorefrontSource(request({
      referer: "https://junior-imports.vercel.app/checkout",
      "sec-fetch-site": "same-origin",
    }))).toBe(true);
  });

  it("bloqueia Referer de outra origem", () => {
    expect(hasAllowedStorefrontSource(request({
      referer: "https://malicioso.exemplo/checkout",
      "sec-fetch-site": "cross-site",
    }))).toBe(false);
  });

  it("bloqueia Referer inválido", () => {
    expect(hasAllowedStorefrontSource(request({
      referer: "endereco-invalido",
      "sec-fetch-site": "same-origin",
    }))).toBe(false);
  });
});
