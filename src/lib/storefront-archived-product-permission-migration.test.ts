import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608270002_storefront_archived_product_permission.sql"),
  "utf8",
);

describe("permissão do marcador de produto arquivado", () => {
  it("libera somente a coluna usada pelo filtro público", () => {
    expect(migration).toContain("grant select (deleted_at) on table public.products to anon, authenticated");
    expect(migration).not.toMatch(/grant select on table public\.products/i);
  });
});
