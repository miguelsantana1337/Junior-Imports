import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import type { StorefrontProduct } from "@/types/store";
import { electronicsStorageOption, groupElectronicsProductModels } from "./electronics-product-variants";
import { buildElectronicsProductGroups } from "./electronics-catalog-view";

function product(name: string, overrides: Partial<StorefrontProduct> = {}): StorefrontProduct {
  return { ...seedData.products[0], id: name, slug: name.toLowerCase().replaceAll(" ", "-"), name,
    categoryId: "electronics", category: "Eletrônicos", brand: "Apple", productType: "non_medicine",
    regulatoryStatus: "approved", active: true, stock: 2, price: 7800, description: "", ...overrides };
}

describe("variações de armazenamento dos eletrônicos", () => {
  it("agrupa capacidades, ordena GB antes de TB e mantém os objetos e IDs originais", () => {
    const variants = [product("iPhone 17 Pro Max 1TB", { price: 12000 }), product("iPhone 17 Pro Max 512GB", { price: 9500 }), product("iPhone 17 Pro Max 256GB", { price: 8300 })];
    const original = structuredClone(variants);
    const models = groupElectronicsProductModels(variants);
    expect(models).toHaveLength(1);
    expect(models[0].product).toBe(variants[2]);
    expect(models[0].selection?.name).toBe("iPhone 17 Pro Max");
    expect(models[0].selection?.options.map(({ label }) => label)).toEqual(["256 GB", "512 GB", "1 TB"]);
    expect(models[0].selection?.options.map(({ product }) => product.id)).toEqual([variants[2].id, variants[1].id, variants[0].id]);
    expect(variants).toEqual(original);
  });

  it("mantém modelos, gerações, tamanhos de tela e RAM diferentes separados", () => {
    const names = ["iPhone 17 256GB", "iPhone 17e 256GB", "iPhone 16 128GB", "iPhone 17 Pro 256GB", "iPhone 17 Pro Max 256GB", 'MacBook Air M5 13,6" 16GB/512GB', 'MacBook Air M5 15,3" 16GB/512GB', 'MacBook Air M5 13,6" 24GB/1TB', "Apple Watch SE 3 40mm", "Apple Watch SE 3 44mm", "AirPods 4 com ANC", "AirPods 4 sem ANC"];
    expect(groupElectronicsProductModels(names.map((name) => product(name)))).toHaveLength(names.length);
    expect(electronicsStorageOption(product(names[5]))?.name).toBe('MacBook Air M5 13,6" 16GB');
    const macbooks = groupElectronicsProductModels([product(names[5]), product('MacBook Air M5 13,6" 16GB/1TB')]);
    expect(macbooks).toHaveLength(1);
    expect(macbooks[0].selection?.options.map(({ label }) => label)).toEqual(["512 GB", "1 TB"]);
  });

  it("não junta marcas ou categorias distintas nem tenta interpretar medicamentos", () => {
    expect(groupElectronicsProductModels([product("iPad 11 A16 128GB"), product("iPad 11 A16 256GB", { brand: "Outra marca" }), product("iPad 11 A16 512GB", { categoryId: "outlet" })])).toHaveLength(3);
    expect(electronicsStorageOption({ ...seedData.products[0], name: "Tirzepatida 15mg" })).toBeNull();
    expect(electronicsStorageOption(product("iPad 11 A16 128GB", { productType: "prescription" }))).toBeNull();
    expect(electronicsStorageOption(product("iPad 11 A16 0GB"))).toBeNull();
    expect(electronicsStorageOption(product("AirTag 4 Pack"))).toBeNull();
  });

  it("não esconde anúncios ambíguos com a mesma capacidade", () => {
    const products = [product("iPhone 17 Pro 256GB"), product("iPhone 17 Pro 256 GB", { id: "outro-256" }), product("iPhone 17 Pro 512GB")];
    const models = groupElectronicsProductModels(products);
    expect(models).toHaveLength(3);
    expect(models.every((model) => !model.selection)).toBe(true);
  });

  it("ignora opções inativas e preserva o cadastro único sem inventar variações", () => {
    const single = product("iPad 11 A16 128GB");
    expect(groupElectronicsProductModels([single, product("iPad 11 A16 256GB", { active: false })])).toEqual([{ product: single }]);
  });

  it("usa o menor preço disponível sem anunciar como comprável uma opção esgotada", () => {
    const cheap = product("iPhone 17 Pro 256GB", { price: 7800, stock: 0 });
    const available = product("iPhone 17 Pro 512GB", { price: 9350, madeToOrder: true });
    expect(groupElectronicsProductModels([cheap, available])[0].product).toBe(available);
    expect(groupElectronicsProductModels([{ ...cheap, stock: 1, regulatoryStatus: "blocked" }, available])[0].product).toBe(available);
    expect(groupElectronicsProductModels([cheap, { ...available, stock: 0 }])[0].product).toBe(cheap);
    expect(groupElectronicsProductModels([cheap, available])[0].selection?.options).toHaveLength(2);
  });

  it("encontra qualquer capacidade na busca sem duplicar o modelo ou perder outras opções", () => {
    const products = [product("iPhone 17 Pro 256GB"), product("iPhone 17 Pro 512GB", { price: 9350 }), product("iPhone 15 128GB", { price: 2930 })];
    const groups = buildElectronicsProductGroups(products, [], "512 GB", "order");
    expect(groups).toHaveLength(1);
    expect(groups[0].products).toHaveLength(1);
    expect(groups[0].selections?.[groups[0].products[0].id].options).toHaveLength(2);
    expect(buildElectronicsProductGroups(products, [], "", "price-asc")[0].products.map(({ price }) => price)).toEqual([2930, 7800]);
    expect(buildElectronicsProductGroups(products, [], "", "price-desc")[0].products.map(({ price }) => price)).toEqual([7800, 2930]);
  });

  it("mantém a posição mais antiga do modelo mesmo que o menor preço esteja em outra opção", () => {
    const products = [product("iPad 11 A16 256GB", { price: 5300, order: 1 }), product("iPad Air 5 64GB", { order: 2 }), product("iPad 11 A16 128GB", { price: 2900, order: 3 })];
    expect(buildElectronicsProductGroups(products, [], "", "order")[0].products.map(({ price }) => price)).toEqual([2900, 7800]);
  });
});
