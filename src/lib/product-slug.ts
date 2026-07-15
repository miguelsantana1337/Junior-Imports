import { slugify } from "@/lib/format";
import type { Product } from "@/types/store";

type ProductSlugOwner = Pick<Product, "id" | "slug">;
type ProductSlugCandidate = Pick<Product, "id" | "slug" | "name" | "sku">;

export type ProductSaveConflictKind = "slug" | "sku" | "duplicate";

const conflictMessages: Record<ProductSaveConflictKind, string> = {
  slug: "Já existe um produto usando este endereço interno. Procure o produto na lista, inclusive entre os ocultos. Se for um item diferente, informe uma apresentação ou um SKU exclusivo e tente novamente.",
  sku: "Este SKU já está sendo usado por outro produto. Procure o produto na lista, inclusive entre os ocultos. Para cadastrar um item diferente, informe um novo SKU e tente novamente.",
  duplicate: "Já existe um produto com a mesma identificação. Procure o item na lista, inclusive entre os ocultos. Se for um produto diferente, altere o nome, a apresentação ou o SKU e tente novamente.",
};

export class ProductSaveConflictError extends Error {
  constructor(public readonly kind: ProductSaveConflictKind) {
    super(conflictMessages[kind]);
    this.name = "ProductSaveConflictError";
  }
}

function errorText(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== "object") return "";
  const record = error as Record<string, unknown>;
  return [record.code, record.message, record.details, record.hint]
    .filter((value) => typeof value === "string")
    .join(" ");
}

export function toProductSaveError(error: unknown): Error {
  if (error instanceof ProductSaveConflictError) return error;
  const text = errorText(error);
  const normalized = text.toLowerCase();
  if (normalized.includes("products_tenant_slug_key") || normalized.includes("(tenant_id, slug)")) {
    return new ProductSaveConflictError("slug");
  }
  if (normalized.includes("products_tenant_sku_key") || normalized.includes("(tenant_id, sku)")) {
    return new ProductSaveConflictError("sku");
  }
  if (normalized.includes("23505") || normalized.includes("duplicate key value")) {
    return new ProductSaveConflictError("duplicate");
  }
  return error instanceof Error ? error : new Error(text || "Não foi possível salvar o produto. Tente novamente.");
}

export function createUniqueProductSlug(value: string, products: ProductSlugOwner[], productId?: string) {
  const base = slugify(value) || "produto";
  const used = new Set(
    products
      .filter((product) => product.id !== productId)
      .map((product) => product.slug),
  );
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

export function ensureUniqueProductSlugs<T extends ProductSlugCandidate>(products: T[], existing: ProductSlugOwner[]) {
  const incomingIds = new Set(products.map((product) => product.id));
  const occupied: ProductSlugOwner[] = existing.filter((product) => !incomingIds.has(product.id));

  return products.map((product) => {
    const slug = createUniqueProductSlug(product.slug || product.name || product.sku, occupied, product.id);
    const next = { ...product, slug };
    occupied.push(next);
    return next;
  });
}
