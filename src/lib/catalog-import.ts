import { slugify } from "@/lib/format";
import { createUniqueProductSlug } from "@/lib/product-slug";
import { productSchema } from "@/lib/validation";
import type { Category, Product, ProductType, RegulatoryStatus, StockImportMode } from "@/types/store";

export type ImportError = { row: number; message: string };
export type StockImportRow = { sku: string; quantity: number };

const productTypeAliases: Record<string, ProductType> = {
  "": "unclassified",
  nao_medicamento: "non_medicine",
  non_medicine: "non_medicine",
  mip: "otc",
  otc: "otc",
  prescricao: "prescription",
  prescription: "prescription",
  controlado: "controlled",
  controlled: "controlled",
  sem_classificacao: "unclassified",
  unclassified: "unclassified",
};

const regulatoryAliases: Record<string, RegulatoryStatus> = {
  "": "pending",
  pendente: "pending",
  pending: "pending",
  aprovado: "approved",
  approved: "approved",
  bloqueado: "blocked",
  blocked: "blocked",
};

const productTemplateHeaders = [
  "sku", "nome", "categoria", "marca", "preco", "preco_comparacao", "cashback", "custo",
  "estoque", "estoque_minimo", "etiqueta", "cor", "descricao", "avaliacao", "numero_avaliacoes",
  "ativo", "destaque", "ordem", "imagem_url", "imagens_urls", "tipo_produto", "status_regulatorio",
  "principio_ativo", "registro_anvisa", "apresentacao", "advertencia", "revisado_farmaceutico",
];

const stockTemplateHeaders = [
  "sku", "nome", "categoria", "marca", "quantidade", "estoque_minimo", "preco", "preco_comparacao",
  "cashback", "custo", "etiqueta", "cor", "descricao", "avaliacao", "numero_avaliacoes", "ativo",
  "destaque", "ordem", "imagem_url", "imagens_urls", "tipo_produto", "status_regulatorio",
  "principio_ativo", "registro_anvisa", "apresentacao", "advertencia", "revisado_farmaceutico",
];

const exportedProductTypes: Record<ProductType, string> = {
  unclassified: "sem_classificacao",
  non_medicine: "nao_medicamento",
  otc: "mip",
  prescription: "prescricao",
  controlled: "controlado",
};

const exportedRegulatoryStatuses: Record<RegulatoryStatus, string> = {
  pending: "pendente",
  approved: "aprovado",
  blocked: "bloqueado",
};

function csvCell(value: string | number) {
  const text = String(value);
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function decimalValue(value: number, digits = 2) {
  return new Intl.NumberFormat("pt-BR", {
    useGrouping: false,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function booleanValue(value: boolean) {
  return value ? "sim" : "nao";
}

function productTemplateRow(product: Product, stockTemplate = false) {
  const common = [
    product.sku,
    product.name,
    product.category,
    product.brand,
    stockTemplate ? product.stock : decimalValue(product.price),
    stockTemplate ? product.minStock : decimalValue(product.compareAt),
  ];

  if (stockTemplate) {
    common.push(decimalValue(product.price), decimalValue(product.compareAt));
  }

  common.push(
    decimalValue(product.cashback),
    decimalValue(product.costPrice),
  );

  if (!stockTemplate) {
    common.push(product.stock, product.minStock);
  }

  common.push(
    product.badge,
    product.accent,
    product.description,
    decimalValue(product.rating, 1),
    product.reviews,
    booleanValue(product.active),
    booleanValue(product.featured),
    product.order,
    product.imageUrl,
    product.imageUrls.join(" | "),
    exportedProductTypes[product.productType],
    exportedRegulatoryStatuses[product.regulatoryStatus],
    product.activeIngredient,
    product.anvisaRegistration,
    product.presentation,
    product.regulatoryWarning,
    booleanValue(product.pharmacistReviewed),
  );

  return common;
}

function serializeTemplate(headers: string[], rows: Array<Array<string | number>>) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\n");
}

export function buildProductImportTemplate(products: Product[]) {
  const rows = products.length
    ? products.map((product) => productTemplateRow(product))
    : [["JI-A05", "Produto exemplo", "Acessórios de cuidado", "Junior Imports", "49,90", "59,90", "5,00", "25,00", 20, 5, "", "#1677ff", "Descrição completa do produto", "5,0", 0, "nao", "nao", 1, "", "", "nao_medicamento", "pendente", "", "", "", "", "nao"]];
  return serializeTemplate(productTemplateHeaders, rows);
}

export function buildStockImportTemplate(products: Product[]) {
  const rows = products.length
    ? products.map((product) => productTemplateRow(product, true))
    : [["JI-A04", "Produto exemplo", "Acessórios de cuidado", "Junior Imports", 25, 5, "49,90", "59,90", "5,00", "25,00", "", "#1677ff", "Descrição completa do produto", "5,0", 0, "nao", "nao", 1, "", "", "nao_medicamento", "pendente", "", "", "", "", "nao"]];
  return serializeTemplate(stockTemplateHeaders, rows);
}

export const productImportTemplate = buildProductImportTemplate([]);
export const stockImportTemplate = buildStockImportTemplate([]);

function normalizeHeader(value: string) {
  return slugify(value).replaceAll("-", "_");
}

function detectDelimiter(text: string) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  return (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
}

export function parseCsv(text: string): Array<Record<string, string>> {
  const clean = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(clean);
  const matrix: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < clean.length; index += 1) {
    const character = clean[index];
    const next = clean[index + 1];
    if (character === '"' && quoted && next === '"') { value += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (character === delimiter && !quoted) { row.push(value.trim()); value = ""; continue; }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && next === "\n") index += 1;
      row.push(value.trim());
      if (row.some(Boolean)) matrix.push(row);
      row = []; value = ""; continue;
    }
    value += character;
  }
  row.push(value.trim());
  if (row.some(Boolean)) matrix.push(row);
  const headers = (matrix.shift() ?? []).map(normalizeHeader);
  return matrix.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function numberValue(value: string) {
  const normalized = value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value;
  return Number(normalized.trim());
}

function boolValue(value: string, fallback: boolean) {
  if (!value.trim()) return fallback;
  return ["1", "true", "sim", "yes", "ativo", "aprovado"].includes(value.trim().toLocaleLowerCase("pt-BR"));
}

export function parseProductImport(text: string, existing: Product[], categories: Category[]) {
  const records = parseCsv(text);
  const products: Product[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();

  records.forEach((record, index) => {
    const row = index + 2;
    const sku = record.sku?.trim().toUpperCase() ?? "";
    if (!sku) { errors.push({ row, message: "SKU não informado." }); return; }
    if (seen.has(sku)) { errors.push({ row, message: `SKU ${sku} repetido na planilha.` }); return; }
    seen.add(sku);
    const current = existing.find((product) => product.sku.toUpperCase() === sku);
    const categoryValue = record.categoria?.trim().toLocaleLowerCase("pt-BR") ?? "";
    const category = categories.find((item) => [item.id, item.name.toLocaleLowerCase("pt-BR"), item.slug].includes(categoryValue));
    if (!category && !current) { errors.push({ row, message: `Categoria “${record.categoria || "vazia"}” não encontrada.` }); return; }
    const price = record.preco ? numberValue(record.preco) : current?.price ?? Number.NaN;
    const cashback = record.cashback ? numberValue(record.cashback) : current?.cashback ?? 0;
    const costPrice = record.custo ? numberValue(record.custo) : current?.costPrice ?? 0;
    const stock = record.estoque ? numberValue(record.estoque) : current?.stock ?? 0;
    const minStock = record.estoque_minimo ? numberValue(record.estoque_minimo) : current?.minStock ?? 0;
    if (!Number.isFinite(price) || price < 0) { errors.push({ row, message: "Preço inválido." }); return; }
    if (!Number.isFinite(cashback) || cashback < 0 || cashback > price) { errors.push({ row, message: "Cashback deve estar entre zero e o preço de venda." }); return; }
    if (!Number.isFinite(costPrice) || costPrice < 0) { errors.push({ row, message: "Custo inválido." }); return; }
    if (!Number.isInteger(stock) || stock < 0) { errors.push({ row, message: "Estoque deve ser um número inteiro maior ou igual a zero." }); return; }
    if (!Number.isInteger(minStock) || minStock < 0) { errors.push({ row, message: "Estoque mínimo deve ser um número inteiro maior ou igual a zero." }); return; }
    const productType = productTypeAliases[(record.tipo_produto ?? "").trim().toLocaleLowerCase("pt-BR")];
    const regulatoryStatus = regulatoryAliases[(record.status_regulatorio ?? "").trim().toLocaleLowerCase("pt-BR")];
    if (!productType) { errors.push({ row, message: "Tipo de produto inválido." }); return; }
    if (!regulatoryStatus) { errors.push({ row, message: "Status regulatório inválido." }); return; }
    const name = record.nome?.trim() || current?.name || "";
    const importedImages = (record.imagens_urls ?? "").split("|").map((item) => item.trim()).filter(Boolean);
    const imageUrl = record.imagem_url?.trim() || current?.imageUrl || importedImages[0] || "";
    const imageUrls = importedImages.length ? importedImages : current?.imageUrls ?? [];
    const gallery = imageUrl && !imageUrls.includes(imageUrl) ? [imageUrl, ...imageUrls] : imageUrls;
    const product: Product = {
      id: current?.id ?? `import-${slugify(sku)}`,
      slug: current?.slug ?? createUniqueProductSlug(name || sku, [...existing, ...products]),
      name,
      categoryId: category?.id ?? current!.categoryId,
      category: category?.name ?? current!.category,
      brand: record.marca?.trim() || current?.brand || "Junior Imports",
      price,
      compareAt: record.preco_comparacao ? numberValue(record.preco_comparacao) : current?.compareAt ?? 0,
      cashback,
      costPrice,
      stock,
      minStock,
      badge: record.etiqueta?.trim() || record.badge?.trim() || current?.badge || "",
      accent: record.cor?.trim() || record.accent?.trim() || current?.accent || "#1677ff",
      description: record.descricao?.trim() || current?.description || "Produto importado por planilha para o catálogo.",
      sku,
      rating: record.avaliacao ? numberValue(record.avaliacao) : current?.rating ?? 0,
      reviews: record.numero_avaliacoes ? numberValue(record.numero_avaliacoes) : current?.reviews ?? 0,
      featured: boolValue(record.destaque ?? "", current?.featured ?? false),
      active: boolValue(record.ativo ?? "", current?.active ?? false),
      order: record.ordem ? numberValue(record.ordem) : current?.order ?? existing.length + products.length + 1,
      imageUrl,
      imageUrls: gallery,
      productType: record.tipo_produto ? productType : current?.productType ?? productType,
      regulatoryStatus: record.status_regulatorio ? regulatoryStatus : current?.regulatoryStatus ?? regulatoryStatus,
      activeIngredient: record.principio_ativo?.trim() || current?.activeIngredient || "",
      anvisaRegistration: record.registro_anvisa?.trim() || current?.anvisaRegistration || "",
      presentation: record.apresentacao?.trim() || current?.presentation || "",
      regulatoryWarning: record.advertencia?.trim() || current?.regulatoryWarning || "",
      pharmacistReviewed: boolValue(record.revisado_farmaceutico ?? "", current?.pharmacistReviewed ?? false),
    };
    const parsed = productSchema.safeParse(product);
    if (!parsed.success) { errors.push({ row, message: parsed.error.issues[0]?.message ?? "Dados inválidos." }); return; }
    products.push(product);
  });
  return { products, errors, totalRows: records.length };
}

export function parseStockImport(text: string, products: Product[]) {
  const records = parseCsv(text);
  const rows: StockImportRow[] = [];
  const errors: ImportError[] = [];
  const seen = new Set<string>();
  records.forEach((record, index) => {
    const row = index + 2;
    const sku = record.sku?.trim().toUpperCase() ?? "";
    const quantity = numberValue(record.quantidade ?? "");
    if (!products.some((product) => product.sku.toUpperCase() === sku)) { errors.push({ row, message: `SKU ${sku || "vazio"} não encontrado.` }); return; }
    if (seen.has(sku)) { errors.push({ row, message: `SKU ${sku} repetido.` }); return; }
    if (!Number.isInteger(quantity) || quantity < 0) { errors.push({ row, message: "Quantidade inválida." }); return; }
    seen.add(sku); rows.push({ sku, quantity });
  });
  return { rows, errors, totalRows: records.length };
}

export function applyStockImport(products: Product[], rows: StockImportRow[], mode: StockImportMode) {
  const quantities = new Map(rows.map((row) => [row.sku.toUpperCase(), row.quantity]));
  return products.map((product) => {
    const quantity = quantities.get(product.sku.toUpperCase());
    if (quantity === undefined) return product;
    const stock = mode === "replace" ? quantity : mode === "increment" ? product.stock + quantity : Math.max(0, product.stock - quantity);
    return { ...product, stock };
  });
}
