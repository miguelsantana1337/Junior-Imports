import { slugify } from "@/lib/format";
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

export const productImportTemplate = `sku;nome;categoria;marca;preco;preco_comparacao;estoque;descricao;ativo;destaque;imagem_url;tipo_produto;status_regulatorio;principio_ativo;registro_anvisa;apresentacao;advertencia;revisado_farmaceutico
JI-A05;Produto exemplo;Acessórios de cuidado;Junior Imports;49,90;59,90;20;Descrição completa do produto;nao;nao;;nao_medicamento;pendente;;;;;nao`;

export const stockImportTemplate = `sku;quantidade
JI-A04;25`;

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
    const stock = record.estoque ? numberValue(record.estoque) : current?.stock ?? 0;
    if (!Number.isFinite(price) || price < 0) { errors.push({ row, message: "Preço inválido." }); return; }
    if (!Number.isInteger(stock) || stock < 0) { errors.push({ row, message: "Estoque deve ser um número inteiro maior ou igual a zero." }); return; }
    const productType = productTypeAliases[(record.tipo_produto ?? "").trim().toLocaleLowerCase("pt-BR")];
    const regulatoryStatus = regulatoryAliases[(record.status_regulatorio ?? "").trim().toLocaleLowerCase("pt-BR")];
    if (!productType) { errors.push({ row, message: "Tipo de produto inválido." }); return; }
    if (!regulatoryStatus) { errors.push({ row, message: "Status regulatório inválido." }); return; }
    const name = record.nome?.trim() || current?.name || "";
    const imageUrl = record.imagem_url?.trim() || current?.imageUrl || "";
    const product: Product = {
      id: current?.id ?? `import-${slugify(sku)}`,
      slug: current?.slug ?? slugify(name || sku),
      name,
      categoryId: category?.id ?? current!.categoryId,
      category: category?.name ?? current!.category,
      brand: record.marca?.trim() || current?.brand || "Junior Imports",
      price,
      compareAt: record.preco_comparacao ? numberValue(record.preco_comparacao) : current?.compareAt ?? 0,
      stock,
      badge: current?.badge ?? "",
      accent: current?.accent ?? "#1677ff",
      description: record.descricao?.trim() || current?.description || "Produto importado por planilha para o catálogo.",
      sku,
      rating: current?.rating ?? 0,
      reviews: current?.reviews ?? 0,
      featured: boolValue(record.destaque ?? "", current?.featured ?? false),
      active: boolValue(record.ativo ?? "", current?.active ?? false),
      order: current?.order ?? existing.length + products.length + 1,
      imageUrl,
      imageUrls: imageUrl ? [imageUrl, ...(current?.imageUrls ?? []).filter((item) => item !== imageUrl)] : current?.imageUrls ?? [],
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
