import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607180007_operational_hardening.sql"),
  "utf8",
);

describe("endurecimento operacional", () => {
  it("cria operações transacionais para colaboração e compras", () => {
    expect(migration).toContain("create or replace function public.create_collaboration_thread");
    expect(migration).toContain("create or replace function public.create_collaboration_comment");
    expect(migration).toContain("create or replace function public.set_collaboration_thread_status");
    expect(migration).toContain("create or replace function public.create_approval_request");
    expect(migration).toContain("create or replace function public.decide_approval");
    expect(migration).toContain("create or replace function public.save_purchase_order");
  });

  it("impede decisão direta e protege o revisor indicado", () => {
    expect(migration).toContain("revoke insert, update, delete on public.approval_requests from authenticated");
    expect(migration).toContain("Esta decisão pertence ao revisor indicado");
    expect(migration).toContain("O solicitante não pode decidir a própria aprovação");
  });

  it("registra a leitura das menções sem liberar dados de outros usuários", () => {
    expect(migration).toContain("create table if not exists public.collaboration_reads");
    expect(migration).toContain("create policy \"own collaboration reads\"");
    expect(migration).toContain("user_id = auth.uid()");
  });

  it("recalcula a ordem de compra a partir dos itens", () => {
    expect(migration).toContain("v_total := v_total +");
    expect(migration).toContain("delete from public.purchase_order_items");
  });
});
