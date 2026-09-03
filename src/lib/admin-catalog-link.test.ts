import { describe, expect, it } from "vitest";
import { adminCatalogHref, adminReferralHref } from "./admin-catalog-link";

const tenant = { slug: "junior-imports", storefrontPath: "/loja/junior-imports" };

describe("atalhos administrativos das vitrines separadas", () => {
  it("abre o editor de conteúdo no catálogo original, inclusive páginas internas", () => {
    expect(adminCatalogHref(tenant, "pharmaceutical")).toBe("https://farmaceuticos.juniorimportsoficial.com.br/");
    expect(adminCatalogHref(tenant, "pharmaceutical", "/paginas/como-comprar")).toBe("https://farmaceuticos.juniorimportsoficial.com.br/paginas/como-comprar");
  });
  it("gera indicações distintas sem mudar o código nem a regra financeira", () => {
    expect(adminReferralHref(tenant, "pharmaceutical", " juniorvip ")).toBe("https://farmaceuticos.juniorimportsoficial.com.br/?indicacao=JUNIORVIP");
    expect(adminReferralHref(tenant, "electronics", "juniorvip")).toBe("https://juniorimportsoficial.com.br/?indicacao=JUNIORVIP");
    expect(adminReferralHref(tenant, "electronics", "")).toBe("");
  });
  it("preserva o endereço de outros tenants", () => {
    const other = { slug: "outra", storefrontPath: "/loja/outra" };
    expect(adminCatalogHref(other, "pharmaceutical", "/paginas/contato")).toBe("/loja/outra/paginas/contato");
    expect(adminReferralHref(other, "electronics", "cliente1")).toBe("/loja/outra?indicacao=CLIENTE1");
  });
});
