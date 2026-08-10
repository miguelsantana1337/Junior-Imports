export type DivergenceSeverity = "critical" | "high" | "medium" | "low";
export type DivergenceStatus = "open" | "analyzing" | "prepared" | "resolved" | "ignored" | "reopened";

export interface OperationalDivergence {
  id: string;
  ruleKey: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  severity: DivergenceSeverity;
  status: DivergenceStatus;
  summary: string;
  evidence: Record<string, unknown>;
  proposedAction: string;
  impactAmount: number | null;
  occurrenceCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  resolutionReason: string;
}

export interface GuardianLine {
  productId: string;
  name: string;
  price: number;
  cost: number | null;
  quantity: number;
  directDiscount?: number;
}

export interface GuardianCoupon {
  type: "percent" | "fixed";
  value: number;
}

export interface GuardianInput {
  lines: GuardianLine[];
  coupon?: GuardianCoupon | null;
  cashbackPercent: number;
  cashbackFixed: number;
  shipping: number;
  minimumMarginPercent: number;
}

export interface GuardianResult {
  gross: number;
  discount: number;
  paidProducts: number;
  shipping: number;
  customerTotal: number;
  cashbackBase: number;
  cashback: number;
  cost: number;
  margin: number;
  marginPercent: number;
  decision: "approved" | "warning" | "blocked";
  warnings: string[];
}

export interface ReferralCampaignRecord {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "ended";
  startsAt: string;
  endsAt: string;
  rewardType: "percent" | "fixed";
  rewardValue: number;
  rewardCap: number;
  creditValidDays: number;
  maximumPerReferrer: number;
  maximumPerMonth: number;
  minimumOrderAmount: number;
}

export interface ReferralCodeRecord {
  id: string;
  customerId: string;
  customerName: string;
  code: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  createdAt: string;
}

export interface ReferralSummary {
  tracked: number;
  rewarded: number;
  blocked: number;
  reversed: number;
  rewardedAmount: number;
}

export interface BundleOptionRecord {
  id: string;
  productId: string;
  productName: string;
  stock: number;
  maxQuantity: number;
  active: boolean;
  order: number;
}

export interface ProductBundleRecord {
  id: string;
  productId: string;
  productName: string;
  name: string;
  selectionLabel: string;
  componentCount: number;
  allowRepetition: boolean;
  maxPerComponent: number;
  active: boolean;
  version: number;
  options: BundleOptionRecord[];
}

export type FunnelStage = "product_viewed" | "added_to_cart" | "checkout_started" | "order_registered" | "whatsapp_opened" | "partial_payment" | "paid" | "delivered";

export interface FunnelMetric {
  stage: FunnelStage;
  sessions: number;
  conversionFromPrevious: number;
}

export interface FeatureFlagRecord {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  killSwitch: boolean;
  rolloutPercentage: number;
  audience: Record<string, unknown>;
  environment: "development" | "preview" | "production" | "all";
  reason: string;
  updatedAt: string;
}

export type MobileDraftIntent = "search_order" | "search_inventory" | "prepare_message" | "inventory_movement" | "unknown";

export interface MobileOperationDraft {
  intent: MobileDraftIntent;
  transcript: string;
  action: string;
  entity: string;
  quantity: number | null;
  movementType: "purchase" | "adjustment" | "loss" | null;
  ambiguous: boolean;
}

export interface ContinuitySummary {
  openAlerts: number;
  criticalAlerts: number;
  lastBackupAt: string;
  lastExternalCopyAt: string;
  lastRecoveryTestAt: string;
  webhookConfigured: boolean;
}
