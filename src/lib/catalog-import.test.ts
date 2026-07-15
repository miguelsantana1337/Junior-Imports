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

  it("substitui ou soma estoque em massa", () => {
    const product = seedData.products[0];
    const parsed = parseStockImport(`sku;quantidade\n${product.sku};5`, seedData.products);
    expect(parsed.errors).toHaveLength(0);
    expect(applyStockImport(seedData.products, parsed.rows, "replace")[0].stock).toBe(5);
    expect(applyStockImport(seedData.products, parsed.rows, "increment")[0].stock).toBe(product.stock + 5);
  });
});
