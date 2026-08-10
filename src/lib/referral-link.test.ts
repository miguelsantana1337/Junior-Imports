import { describe, expect, it } from "vitest";
import {
  buildReferralSharePath,
  buildReferralShareUrl,
  normalizeReferralCode,
  referralCodeFromSearch,
  referralStorageKey,
} from "@/lib/referral-link";

describe("referral links", () => {
  it("normaliza o código compartilhado sem aceitar caracteres extras", () => {
    expect(normalizeReferralCode(" miguel vip-01 ")).toBe("MIGUELVIP-01");
    expect(normalizeReferralCode("cliente_10")).toBe("CLIENTE_10");
  });

  it("aceita o parâmetro atual e o legado", () => {
    expect(referralCodeFromSearch("?indicacao=juniorvip")).toBe("JUNIORVIP");
    expect(referralCodeFromSearch("?ref=cliente10")).toBe("CLIENTE10");
    expect(referralCodeFromSearch("?indicacao=&ref=legado")).toBe("LEGADO");
  });

  it("gera links para a loja principal e para uma loja com slug", () => {
    expect(buildReferralShareUrl("https://junior-imports.vercel.app", "", "juniorvip"))
      .toBe("https://junior-imports.vercel.app/?indicacao=JUNIORVIP");
    expect(buildReferralShareUrl("https://junior-imports.vercel.app", "/loja/outra", "cliente10"))
      .toBe("https://junior-imports.vercel.app/loja/outra?indicacao=CLIENTE10");
    expect(buildReferralSharePath("/loja/outra", "cliente10"))
      .toBe("/loja/outra?indicacao=CLIENTE10");
  });

  it("isola o código por loja na sessão do navegador", () => {
    expect(referralStorageKey("tenant-1")).toBe("tenant-1:referral-code:v1");
  });
});
