import type {
  CashbackCampaign,
  Coupon,
  CustomerSegment,
  MarketingPublication,
  MarketingPublicationKind,
  MarketingPublicationStatus,
  MessageAutomation,
  Order,
} from "@/types/store";

export interface MarketingCalendarItem {
  id: string;
  publicationId: string;
  name: string;
  kind: MarketingPublicationKind;
  status: MarketingPublicationStatus;
  startsAt: string;
  endsAt: string;
  source: "workflow" | "legacy";
}
const transitions: Record<MarketingPublicationStatus, MarketingPublicationStatus[]> = {
  draft: ["in_review"],
  in_review: ["draft", "approved"],
  approved: ["draft", "scheduled", "published"],
  scheduled: ["draft", "published", "paused"],
  published: ["paused", "archived"],
  paused: ["draft", "scheduled", "published", "archived"],
  archived: ["draft"],
};

export function canTransitionPublication(from: MarketingPublicationStatus, to: MarketingPublicationStatus) {
  return transitions[from].includes(to);
}

export function publicationNextStatuses(status: MarketingPublicationStatus) {
  return transitions[status];
}

export function marketingCalendarItems(
  publications: MarketingPublication[],
  coupons: Coupon[],
  cashbackCampaigns: CashbackCampaign[],
): MarketingCalendarItem[] {
  const linked = new Set(publications.filter((item) => item.entityId).map((item) => `${item.kind}:${item.entityId}`));
  const workflow = publications.map((publication) => ({
    id: `publication:${publication.id}`,
    publicationId: publication.id,
    name: publication.name,
    kind: publication.kind,
    status: publication.status,
    startsAt: publication.startsAt,
    endsAt: publication.endsAt,
    source: "workflow" as const,
  }));
  const couponItems = coupons
    .filter((coupon) => (coupon.startsAt || coupon.expiresAt) && !linked.has(`coupon:${coupon.id}`))
    .map((coupon) => ({
      id: `coupon:${coupon.id}`,
      publicationId: "",
      name: `Cupom ${coupon.code}`,
      kind: "coupon" as const,
      status: coupon.active ? "published" as const : "draft" as const,
      startsAt: coupon.startsAt || coupon.expiresAt,
      endsAt: coupon.expiresAt,
      source: "legacy" as const,
    }));
  const cashbackItems = cashbackCampaigns
    .filter((campaign) => !linked.has(`cashback:${campaign.id}`))
    .map((campaign) => ({
      id: `cashback:${campaign.id}`,
      publicationId: "",
      name: campaign.name,
      kind: "cashback" as const,
      status: campaign.status === "active" ? "published" as const : campaign.status === "paused" ? "paused" as const : campaign.status === "ended" ? "archived" as const : "draft" as const,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      source: "legacy" as const,
    }));
  return [...workflow, ...couponItems, ...cashbackItems].sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
}

export function calendarItemsForDay(items: MarketingCalendarItem[], day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = start + 86_400_000 - 1;
  return items.filter((item) => {
    const itemStart = new Date(item.startsAt).getTime();
    const itemEnd = item.endsAt ? new Date(item.endsAt).getTime() : itemStart;
    return Number.isFinite(itemStart) && itemStart <= end && itemEnd >= start;
  });
}

export function renderAutomationTemplate(template: string, order: Order) {
  return template
    .replaceAll("{{cliente}}", order.customer.name || "Cliente")
    .replaceAll("{{pedido}}", order.code)
    .replaceAll("{{status}}", order.status)
    .replaceAll("{{total}}", new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(order.total));
}

export function automationMatchesOrder(automation: MessageAutomation, order: Order, segment: CustomerSegment | "all" = "all") {
  if (automation.triggerType !== "order_status" || automation.triggerValue !== order.status) return false;
  if (automation.conditions.minOrderTotal > order.total) return false;
  if (automation.conditions.orderSource !== "any" && automation.conditions.orderSource !== (order.orderSource ?? "legacy")) return false;
  if (automation.conditions.customerSegment !== "all" && automation.conditions.customerSegment !== segment) return false;
  return automation.status === "active" && automation.active;
}

export function simulateMessageAutomation(automation: MessageAutomation, order: Order) {
  return {
    subject: renderAutomationTemplate(automation.subject, order),
    message: renderAutomationTemplate(automation.message, order),
    recipient: automation.channel === "whatsapp" ? order.customer.phone : order.customer.email,
    channel: automation.channel,
  };
}
