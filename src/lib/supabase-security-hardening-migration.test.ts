import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608090001_supabase_security_advisor_hardening.sql"),
  "utf8",
).toLowerCase();

describe("hardening do Security Advisor do Supabase", () => {
  it("troca a view com privilégios do criador por uma view security invoker", () => {
    expect(migration).toContain("create view public.storefront_products");
    expect(migration).toContain("security_invoker = true");
    expect(migration).not.toContain("security_invoker = false");
  });

  it("não expõe estoque exato nem reservas na projeção pública", () => {
    const viewStart = migration.indexOf("create view public.storefront_products");
    const viewEnd = migration.indexOf("revoke all on table public.storefront_products", viewStart);
    const view = migration.slice(viewStart, viewEnd);

    expect(view).not.toContain("product.stock");
    expect(view).not.toContain("order_stock_reservations");
    expect(migration).toContain("least(10, quantity)");
  });

  it("restringe visitantes às colunas públicas e remove listagem dos buckets", () => {
    expect(migration).toContain("revoke all on table public.products from anon");
    expect(migration).not.toMatch(/grant select \([^;]*(stock|cost_price|sku|min_stock)[^;]*\) on table public\.products to anon/);
    expect(migration).toContain('drop policy if exists "public media read" on storage.objects');
    expect(migration).toContain('drop policy if exists "public site media read" on storage.objects');
  });

  it("fecha helpers internos e funções de trigger para os papéis da API", () => {
    expect(migration).toContain("procedure.prorettype = 'pg_catalog.trigger'::regtype");
    expect(migration).toContain("revoke all on function %s from public, anon, authenticated");
    expect(migration).toContain("coupon_applicable_subtotal(uuid, text, jsonb)");
    expect(migration).toContain("process_public_marketing_schedule(uuid)");
    expect(migration).toContain("to service_role");
  });

  it("fixa o search_path do utilitário de Storage", () => {
    expect(migration).toContain("alter function public.storage_tenant_id(text) set search_path = pg_catalog");
  });
});
