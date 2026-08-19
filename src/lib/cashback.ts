import type { CashbackCampaign, CashbackEntry, CashbackEntryKind, CustomerSegment, StorefrontProduct } from "@/types/store";

const creditKinds = new Set<CashbackEntryKind>(["order_credit", "campaign_bonus", "adjustment_credit"]);

export interface CashbackWalletSummary {
  available: number;
  credited: number;
  redeemed: number;
  adjusted: number;
  expired: number;
  expiringSoon: number;
  entryCount: number;
}

export function isCashbackCredit(kind: CashbackEntryKind) {
  return creditKinds.has(kind);
}

export function cashbackWalletSummary(entries: CashbackEntry[], customerId?: string, now = new Date()): CashbackWalletSummary {
  const relevant = customerId ? entries.filter((entry) => entry.customerId === customerId) : entries;
  const nowTime = now.getTime();
  const soonTime = nowTime + 30 * 86_400_000;
  let activeCredits = 0;
  let unallocatedDebits = 0;
  let credited = 0;
  let redeemed = 0;
  let adjusted = 0;
  let expired = 0;
  let expiringSoon = 0;

  for (const entry of relevant) {
    const remaining = Math.max(0, entry.remainingAmount);
    if (isCashbackCredit(entry.kind)) {
      credited += entry.amount;
      if (entry.kind === "adjustment_credit") adjusted += entry.amount;
      const expiry = entry.expiresAt ? new Date(entry.expiresAt).getTime() : Number.POSITIVE_INFINITY;
      if (expiry <= nowTime) expired += remaining;
      else {
        activeCredits += remaining;
        if (expiry <= soonTime) expiringSoon += remaining;
      }
    } else {
      if (entry.kind === "redemption") redeemed += entry.amount;
      if (entry.kind === "adjustment_debit") adjusted -= entry.amount;
      unallocatedDebits += Math.max(0, entry.amount - entry.allocatedAmount);
    }
  }

  return {
    available: Math.max(0, activeCredits - unallocatedDebits),
    credited,
    redeemed,
    adjusted,
    expired,
    expiringSoon,
    entryCount: relevant.length,
  };
}

export function cashbackEntryState(entry: CashbackEntry, now = new Date()) {
  if (!isCashbackCredit(entry.kind)) return "posted" as const;
  if (entry.remainingAmount <= 0) return "used" as const;
  if (entry.expiresAt && new Date(entry.expiresAt).getTime() <= now.getTime()) return "expired" as const;
  return "available" as const;
}

export function activeCashbackCampaigns(campaigns: CashbackCampaign[], now = new Date()) {
  const timestamp = now.getTime();
  return campaigns.filter((campaign) => campaign.status === "active"
    && (!campaign.startsAt || new Date(campaign.startsAt).getTime() <= timestamp)
    && (!campaign.endsAt || new Date(campaign.endsAt).getTime() >= timestamp));
}

export function campaignAudienceLabel(segments: CustomerSegment[]) {
  return segments.length ? segments.length === 1 ? "1 segmento" : `${segments.length} segmentos` : "Todos os clientes";
}

export function storefrontCashbackOffer(product: StorefrontProduct, campaigns: CashbackCampaign[]) {
  const campaign = activeCashbackCampaigns(campaigns)
    .filter((item) => item.targetSegments.length === 0)
    .filter((item) => item.productIds.length === 0 || item.productIds.includes(product.id))
    .sort((left, right) => right.priority - left.priority)[0];

  if (campaign) {
    return { type: "percent" as const, value: campaign.multiplier, fixedBonus: campaign.fixedBonus, campaign: true };
  }
  return { type: product.cashbackType, value: product.cashback, fixedBonus: 0, campaign: false };
}
