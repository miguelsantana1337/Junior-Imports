import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608270001_safe_product_archive_and_unpaid_delivery.sql"),
  "utf8",
);

describe("exclusão segura de produtos", () => {
  it("arquiva o produto e preserva as referências históricas", () => {
    const archiveFunction = migration.slice(
      migration.indexOf("create or replace function public.archive_tenant_product"),
      migration.indexOf("-- Mesmo que uma consulta pública"),
    );

    expect(archiveFunction).toContain("active = false");
    expect(archiveFunction).toContain("featured = false");
    expect(archiveFunction).toContain("deleted_at = v_deleted_at");
    expect(archiveFunction).toContain("'history_preserved', true");
    expect(archiveFunction).not.toMatch(/delete\s+from\s+public\.products/i);
  });

  it("libera SKU e slug para um cadastro futuro sem expor o item arquivado", () => {
    expect(migration).toContain("slug = left(slug, 180) || '-excluido-'");
    expect(migration).toContain("sku = left(sku, 180) || '-EXCL-'");
    expect(migration).toContain("and product.deleted_at is null");
  });

  it("exige permissão de catálogo e não libera a função para visitantes", () => {
    expect(migration).toContain("has_tenant_permission(p_tenant_id, 'catalog')");
    expect(migration).toContain("revoke all on function public.archive_tenant_product");
    expect(migration).not.toMatch(/grant execute on function public\.archive_tenant_product\([^;]+to (anon|public)/);
  });
});
