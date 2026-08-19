import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/202608190001_weekly_campaign.sql"), "utf8");

describe("campanha semanal no banco", () => {
  it("protege Pix e frete com valor minimo e validade", () => {
    expect(migration).toContain("pix_discount_minimum");
    expect(migration).toContain("promotion_ends_at >= now()");
    expect(migration).toContain("free_shipping_threshold = 500");
  });

  it("reserva uma unica recompensa por ciclo de compras", () => {
    expect(migration).toContain("loyalty_reward_reservations_active_cycle");
    expect(migration).toContain("mod(v_previous_paid + 1, v_settings.loyalty_order_interval)");
    expect(migration).toContain("status = 'released'");
  });

  it("mantem cashback sob o Guardiao financeiro", () => {
    expect(migration).toContain("'cashback-week-2026-08-19'");
    expect(migration).toContain("'draft'");
    expect(migration).toContain("Guardião financeiro");
  });

  it("configura indicação em 10% sem teto", () => {
    expect(migration).toContain("'percent', 10, 0, 90, 0");
    expect(migration).toContain("Indique e ganhe 10%");
  });

  it("não aplica a campanha retroativamente a pedidos existentes", () => {
    expect(migration).toContain("promotion_starts_at = now()");
    expect(migration).toContain("starts_at <= v_order.created_at");
    expect(migration).toContain("v_reward.reward_value / 100");
    expect(migration).toContain("status = 'ended'");
  });
});
