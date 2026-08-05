import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABANDONED_CART_AFTER_MINUTES, cartRecoveryMessage, trackedCartStatus } from "./abandoned-cart";
import type { TrackedCart } from "@/types/abandoned-cart";

const cart = {
  status: "active",
  lastActivityAt: "2026-08-05T12:00:00.000Z",
} as Pick<TrackedCart, "status" | "lastActivityAt">;

describe("detecção de carrinhos abandonados", () => {
  it("considera abandonado somente após o período sem atividade", () => {
    expect(trackedCartStatus(cart, new Date("2026-08-05T12:29:59.000Z").getTime())).toBe("active");
    expect(trackedCartStatus(cart, new Date("2026-08-05T12:30:00.000Z").getTime())).toBe("abandoned");
    expect(ABANDONED_CART_AFTER_MINUTES).toBe(30);
  });

  it("preserva estados encerrados e cria uma mensagem humana de recuperação", () => {
    expect(trackedCartStatus({ ...cart, status: "recovered" }, Date.now())).toBe("recovered");
    expect(cartRecoveryMessage({ customerName: "Maria da Silva", items: [{ productId: "p1", name: "Produto A", quantity: 2, unitPrice: 10 }] }, "Junior Imports"))
      .toContain("Olá, Maria!");
  });

  it("protege a tabela e limita a captura pública no banco", () => {
    const migration = readFileSync("supabase/migrations/202608050002_abandoned_cart_detection.sql", "utf8");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on public.storefront_cart_sessions from anon, authenticated");
    expect(migration).toContain("'cart'");
  });
});
