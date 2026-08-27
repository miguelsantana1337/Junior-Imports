import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608270001_safe_product_archive_and_unpaid_delivery.sql"),
  "utf8",
);

describe("entrega com saldo em aberto", () => {
  it("restringe a exceção ao proprietário e exige justificativa", () => {
    expect(migration).toContain("member.role = 'owner'");
    expect(migration).toContain("Somente o proprietário pode autorizar entrega com saldo em aberto");
    expect(migration).toContain("Explique a entrega com saldo em aberto em pelo menos 5 caracteres");
    expect(migration).toContain("Entrega com saldo em aberto: ' || v_reason");
  });

  it("baixa o estoque uma vez sem reconhecer receita antes do recebimento", () => {
    expect(migration).toContain("commit_tenant_order_stock_on_payment(p_tenant_id, p_order_id)");
    expect(migration).toContain("when v_operation = 'Entregue' and v_payment = 'Recebido' then 'Entregue'");
    expect(migration).toContain("else 'Novo'");
  });

  it("continua aceitando parcelas depois da entrega e preserva Entregue na quitação", () => {
    const registerPayment = migration.slice(
      migration.indexOf("create or replace function public.register_tenant_order_payment"),
      migration.indexOf("create or replace function public.set_tenant_order_archived"),
    );

    expect(registerPayment).toContain("if v_order.operational_status = 'Cancelado'");
    expect(registerPayment).not.toContain("operational_status in ('Cancelado', 'Entregue')");
    expect(registerPayment).toContain("when v_complete and v_order.operational_status = 'Entregue' then 'Entregue'");
  });

  it("impede arquivamento enquanto houver saldo", () => {
    expect(migration).toContain("v_order.operational_status = 'Entregue' and v_order.payment_status <> 'Recebido'");
    expect(migration).toContain("Quite o saldo antes de arquivar este pedido entregue");
  });
});
