import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { applyStockImport, parseCsv, parseProductImport, parseStockImport } from "./catalog-import";

describe("importação de catálogo por planilha", () => {
  it("lê CSV separado por ponto e vírgula e valores com vírgula", () => {
    expect(parseCsv('sku;nome;preco\nABC;"Produto teste";49,90')[0]).toEqual({ sku: "ABC", nome: "Produto teste", preco: "49,90" });
  });

  it("atualiza produto existente pelo SKU", () => {
    const product = seedData.products.at(-1)!;
    const result = parseProductImport(`sku;nome;categoria;preco;estoque\n${product.sku};${product.name};${product.category};99,90;12`, seedData.products, seedData.categories);
    expect(result.errors).toHaveLength(0);
    expect(result.products[0].id).toBe(product.id);
    expect(result.products[0].stock).toBe(12);
  });

  it("importa cashback e rejeita valor maior que o preço", () => {
    const product = seedData.products.at(-1)!;
    const valid = parseProductImport(`sku;nome;categoria;preco;cashback\n${product.sku};${product.name};${product.category};99,90;12,50`, seedData.products, seedData.categories);
    const invalid = parseProductImport(`sku;nome;categoria;preco;cashback\n${product.sku};${product.name};${product.category};99,90;120,00`, seedData.products, seedData.categories);

    expect(valid.errors).toHaveLength(0);
    expect(valid.products[0].cashback).toBe(12.5);
    expect(invalid.errors[0]?.message).toContain("Cashback");
  });

  it("gera endereços diferentes para produtos importados com o mesmo nome", () => {
    const category = seedData.categories[0];
    const result = parseProductImport(
      `sku;nome;categoria;preco;estoque\nJI-NOVO-1;Produto repetido;${category.name};99,90;12\nJI-NOVO-2;Produto repetido;${category.name};109,90;8`,
      seedData.products,
      seedData.categories,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.products.map((product) => product.slug)).toEqual(["produto-repetido", "produto-repetido-2"]);
  });

  it("substitui ou soma estoque em massa", () => {
    const product = seedData.products[0];
    const parsed = parseStockImport(`sku;quantidade\n${product.sku};5`, seedData.products);
    expect(parsed.errors).toHaveLength(0);
    expect(applyStockImport(seedData.products, parsed.rows, "replace")[0].stock).toBe(5);
    expect(applyStockImport(seedData.products, parsed.rows, "increment")[0].stock).toBe(product.stock + 5);
  });
});
