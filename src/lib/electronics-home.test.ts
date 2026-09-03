import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { scopeStorefrontData } from "./storefront-catalog-scope";
import { electronicsHomeBlock, electronicsHomeHref, electronicsHomeKeys, electronicsHomePage, resolveElectronicsHome } from "./electronics-home";
import { pageBlockSchema, storePageSchema } from "./validation";

describe("editor da home de eletrônicos", () => {
  it("começa com conteúdo completo e compatível com o editor existente", () => {
    const tenant = seedData.tenant.id;
    expect(storePageSchema.safeParse(electronicsHomePage(tenant)).success).toBe(true);
    for (const key of electronicsHomeKeys) expect(pageBlockSchema.safeParse(electronicsHomeBlock(tenant, key)).success).toBe(true);
    expect(resolveElectronicsHome(tenant, []).hero.title).toContain("Tecnologia Apple");
    expect(resolveElectronicsHome(tenant, [])["banner-2"].active).toBe(false);
  });
  it("usa valores salvos, inclusive textos opcionais vazios, sem alterar outros blocos", () => {
    const hero = { ...electronicsHomeBlock(seedData.tenant.id, "hero"), title: "Minha loja de tecnologia", body: "" };
    const result = resolveElectronicsHome(seedData.tenant.id, [hero]);
    expect(result.hero.title).toBe(hero.title);
    expect(result.hero.body).toBe("");
    expect(result.catalog.title).toContain("Tecnologia selecionada");
    expect(resolveElectronicsHome("outro-tenant", [hero]).hero.title).not.toBe(hero.title);
  });
  it("não envia textos da outra vitrine e preserva as configurações financeiras", () => {
    const announcement = { ...electronicsHomeBlock(seedData.tenant.id, "announcement"), title: "Anúncio eletrônico" };
    const footer = { ...electronicsHomeBlock(seedData.tenant.id, "footer"), body: "Rodapé eletrônico" };
    const data = { ...seedData, pages: [...seedData.pages, electronicsHomePage(seedData.tenant.id)], pageBlocks: [...seedData.pageBlocks, announcement, footer] };
    const electronics = scopeStorefrontData(data, "electronics");
    const pharma = scopeStorefrontData(data, "pharmaceutical");
    expect(electronics.pageBlocks).toEqual([announcement, footer]);
    expect(electronics.pages).toEqual([]);
    expect(electronics.settings.announcement).toBe(announcement.title);
    expect(electronics.settings.footerDescription).toBe(footer.body);
    expect(electronics.settings.whatsapp).toBe(data.settings.whatsapp);
    expect(electronics.settings.pixDiscount).toBe(data.settings.pixDiscount);
    expect(JSON.stringify(pharma)).not.toContain("Rodapé eletrônico");
    expect(pharma.pages).toEqual(seedData.pages);
  });
  it("mantém destinos dentro da própria vitrine e rejeita esquemas e hosts externos", () => {
    for (const safe of ["/#catalogo", "/#como-comprar", "#catalogo", "/produtos/iphone?q=teste"]) expect(electronicsHomeHref(safe)).toBe(safe);
    for (const invalid of ["https://outro.com", "//outro.com", "/\\outro.com", "javascript:alert(1)", "", "/ caminho"]) expect(electronicsHomeHref(invalid)).toBe("/#catalogo");
  });
});
