import { describe, expect, it } from "vitest";
import { activeCashbackCampaigns, cashbackEntryState, cashbackWalletSummary } from "./cashback";
import type { CashbackCampaign, CashbackEntry } from "@/types/store";

const baseEntry: CashbackEntry = {
  id: "entry-1",
  customerId: "customer-1",
  kind: "order_credit",
  amount: 100,
  description: "Pedido",
  orderId: "order-1",
  campaignId: "",
  referenceEntryId: "",
  operationId: "operation-1",
  expiresAt: "2026-08-20T00:00:00.000Z",
  actorEmail: "",
  createdAt: "2026-07-18T00:00:00.000Z",
  allocatedAmount: 25,
  remainingAmount: 75,
};

describe("carteira de cashback", () => {
  it("calcula saldo, uso e expiração sem editar créditos históricos", () => {
    const entries: CashbackEntry[] = [
      baseEntry,
      { ...baseEntry, id: "debit-1", kind: "redemption", amount: 25, allocatedAmount: 25, remainingAmount: 0, expiresAt: "" },
      { ...baseEntry, id: "expired-1", amount: 40, allocatedAmount: 10, remainingAmount: 30, expiresAt: "2026-07-01T00:00:00.000Z" },
      { ...baseEntry, id: "adjustment-1", kind: "adjustment_debit", amount: 5, allocatedAmount: 0, remainingAmount: 0, expiresAt: "" },
    ];
    const summary = cashbackWalletSummary(entries, "customer-1", new Date("2026-07-18T12:00:00.000Z"));
    expect(summary.available).toBe(70);
    expect(summary.credited).toBe(140);
    expect(summary.redeemed).toBe(25);
    expect(summary.adjusted).toBe(-5);
    expect(summary.expired).toBe(30);
  });

  it("classifica créditos disponíveis, usados e vencidos", () => {
    const now = new Date("2026-07-18T12:00:00.000Z");
    expect(cashbackEntryState(baseEntry, now)).toBe("available");
    expect(cashbackEntryState({ ...baseEntry, remainingAmount: 0 }, now)).toBe("used");
    expect(cashbackEntryState({ ...baseEntry, expiresAt: "2026-07-01T00:00:00.000Z" }, now)).toBe("expired");
  });

  it("considera somente campanhas ativas dentro da janela", () => {
    const campaign: CashbackCampaign = { id: "campaign-1", name: "VIP", description: "", status: "active", startsAt: "2026-07-01T00:00:00.000Z", endsAt: "2026-07-31T23:59:59.000Z", multiplier: 2, fixedBonus: 0, creditValidDays: 90, priority: 10, targetSegments: ["vip"], productIds: [], createdAt: "", updatedAt: "" };
    expect(activeCashbackCampaigns([campaign], new Date("2026-07-18T12:00:00.000Z"))).toHaveLength(1);
    expect(activeCashbackCampaigns([{ ...campaign, status: "paused" }], new Date("2026-07-18T12:00:00.000Z"))).toHaveLength(0);
  });
});
