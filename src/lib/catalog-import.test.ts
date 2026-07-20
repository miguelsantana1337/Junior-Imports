import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { applyStockImport, buildProductImportTemplate, buildStockImportTemplate, parseCsv, parseProductImport, parseStockImport } from "./catalog-import";

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

  it("gera o modelo de produtos preenchido com todos os dados atuais", () => {
    const rows = parseCsv(buildProductImportTemplate(seedData.products));
    const first = seedData.products[0];

    expect(rows).toHaveLength(seedData.products.length);
    expect(rows[0]).toMatchObject({
      sku: first.sku,
      nome: first.name,
      categoria: first.category,
      preco: first.price.toFixed(2).replace(".", ","),
      cashback: first.cashback.toFixed(2).replace(".", ","),
      estoque: String(first.stock),
      etiqueta: first.badge,
      imagem_url: first.imageUrl,
      apresentacao: first.presentation,
    });
    expect(rows[0].imagens_urls).toBe(first.imageUrls.join(" | "));
  });

  it("gera o modelo de estoque com todos os produtos e o saldo atual", () => {
    const rows = parseCsv(buildStockImportTemplate(seedData.products));
    const first = seedData.products[0];

    expect(rows).toHaveLength(seedData.products.length);
    expect(rows[0]).toMatchObject({
      sku: first.sku,
      nome: first.name,
      quantidade: String(first.stock),
      estoque_minimo: String(first.minStock),
      custo: first.costPrice.toFixed(2).replace(".", ","),
      preco: first.price.toFixed(2).replace(".", ","),
    });
  });

  it("reimporta o modelo preenchido preservando os campos completos", () => {
    const current = seedData.products[0];
    const result = parseProductImport(
      buildProductImportTemplate([current]),
      [],
      seedData.categories,
    );

    expect(result.errors).toHaveLength(0);
    expect(result.products[0]).toMatchObject({
      name: current.name,
      sku: current.sku,
      categoryId: current.categoryId,
      brand: current.brand,
      price: current.price,
      compareAt: current.compareAt,
      cashback: current.cashback,
      costPrice: current.costPrice,
      stock: current.stock,
      minStock: current.minStock,
      badge: current.badge,
      accent: current.accent,
      description: current.description,
      rating: current.rating,
      reviews: current.reviews,
      featured: current.featured,
      active: current.active,
      order: current.order,
      imageUrl: current.imageUrl,
      imageUrls: current.imageUrls,
      productType: current.productType,
      regulatoryStatus: current.regulatoryStatus,
      activeIngredient: current.activeIngredient,
      anvisaRegistration: current.anvisaRegistration,
      presentation: current.presentation,
      regulatoryWarning: current.regulatoryWarning,
      pharmacistReviewed: current.pharmacistReviewed,
    });
  });
});
