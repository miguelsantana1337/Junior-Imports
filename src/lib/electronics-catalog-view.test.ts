import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { buildElectronicsProductGroups, electronicsProductFamily } from "./electronics-catalog-view";

function product(name: string, order = 1) {
  return { ...seedData.products[0], id: name, name, brand: "Apple", active: true, order };
}

describe("famílias da vitrine de eletrônicos", () => {
  it("organiza os modelos em famílias úteis sem mudar a categoria técnica", () => {
    const products = [product("iPhone 17 Pro"), product("Apple Watch Ultra 3"), product("Apple Pencil USB-C")];
    expect(products.map(electronicsProductFamily)).toEqual(["iphone", "apple-watch", "acessorios"]);
    expect(buildElectronicsProductGroups(products, [], "", "order").map((group) => group.name)).toEqual(["iPhone", "Apple Watch", "Acessórios"]);
  });

  it("mantém busca e ordenação dentro das famílias", () => {
    const products = [{ ...product("iPhone 17 Pro", 2), price: 7800 }, { ...product("iPhone 15", 1), price: 2930 }, product("AirPods Pro 3", 3)];
    const groups = buildElectronicsProductGroups(products, [], "iphone", "price-desc");
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe("iPhone");
    expect(groups[0].products).toHaveLength(2);
    expect(groups[0].products.map((product) => product.price)).toEqual([7800, 2930]);
    expect(buildElectronicsProductGroups(products, [], "iphone", "price-asc")[0].products.map((product) => product.price)).toEqual([2930, 7800]);
  });

  it("esconde produtos inativos e não chama produtos desconhecidos de acessórios", () => {
    const products = [product("Console"), { ...product("iPhone 15"), active: false }, product("AirTag 4 Pack")];
    const groups = buildElectronicsProductGroups(products, [], "", "order");
    expect(groups.map((group) => group.name)).toEqual(["Acessórios", "Outros eletrônicos"]);
    expect(groups.flatMap((group) => group.products)).toHaveLength(2);
  });
});
