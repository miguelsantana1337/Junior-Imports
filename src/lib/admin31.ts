import type {
  FunnelStage,
  GuardianInput,
  GuardianResult,
  MobileOperationDraft,
} from "@/types/admin31";

const money = (value: number) => Number(Math.max(0, value).toFixed(2));

export function simulateCampaignGuardian(input: GuardianInput): GuardianResult {
  const gross = money(input.lines.reduce((sum, line) => sum + Math.max(0, line.price) * Math.max(0, line.quantity), 0));
  const directDiscount = money(input.lines.reduce((sum, line) => sum + Math.max(0, line.directDiscount ?? 0) * Math.max(0, line.quantity), 0));
  const afterDirect = money(gross - Math.min(gross, directDiscount));
  const couponDiscount = input.coupon
    ? input.coupon.type === "percent"
      ? money(afterDirect * Math.min(100, Math.max(0, input.coupon.value)) / 100)
      : money(Math.min(afterDirect, Math.max(0, input.coupon.value)))
    : 0;
  const paidProducts = money(afterDirect - couponDiscount);
  const cashback = money(paidProducts * Math.min(100, Math.max(0, input.cashbackPercent)) / 100 + Math.max(0, input.cashbackFixed));
  const cost = money(input.lines.reduce((sum, line) => sum + Math.max(0, line.cost ?? 0) * Math.max(0, line.quantity), 0));
  const margin = Number((paidProducts - cashback - cost).toFixed(2));
  const marginPercent = paidProducts > 0 ? Number((margin / paidProducts * 100).toFixed(2)) : 0;
  const missingCost = input.lines.some((line) => line.cost === null);
  const warnings: string[] = [];
  if (missingCost) warnings.push("Há produto sem custo cadastrado.");
  if (margin < 0) warnings.push("A campanha produz margem negativa.");
  if (!missingCost && margin >= 0 && marginPercent < input.minimumMarginPercent) {
    warnings.push(`A margem fica abaixo do mínimo de ${input.minimumMarginPercent.toLocaleString("pt-BR")}%.`);
  }
  const decision = missingCost || margin < 0
    ? "blocked"
    : marginPercent < input.minimumMarginPercent
      ? "warning"
      : "approved";
  return {
    gross,
    discount: money(directDiscount + couponDiscount),
    paidProducts,
    shipping: money(input.shipping),
    customerTotal: money(paidProducts + input.shipping),
    cashbackBase: paidProducts,
    cashback,
    cost,
    margin,
    marginPercent,
    decision,
    warnings,
  };
}

export function bundleAvailability(stocks: number[], componentCount: number) {
  if (!Number.isInteger(componentCount) || componentCount <= 0) return 0;
  const total = stocks.reduce((sum, stock) => sum + Math.max(0, Math.floor(stock)), 0);
  return Math.floor(total / componentCount);
}

export const funnelStageOrder: FunnelStage[] = [
  "product_viewed",
  "added_to_cart",
  "checkout_started",
  "order_registered",
  "whatsapp_opened",
  "partial_payment",
  "paid",
  "delivered",
];

export function normalizeFunnelProgress(stages: FunnelStage[]) {
  const unique = new Set(stages);
  return funnelStageOrder.filter((stage) => unique.has(stage));
}

export function parseMobileOperationDraft(transcript: string): MobileOperationDraft {
  const normalized = transcript.trim().replace(/\s+/g, " ");
  const lower = normalized.toLocaleLowerCase("pt-BR");
  const quantityMatch = lower.match(/\b(\d{1,6})\b/);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : null;
  if (/\b(buscar|procurar|abrir|ver)\b.*\bpedido\b/.test(lower)) {
    return { intent: "search_order", transcript: normalized, action: "Buscar pedido", entity: normalized.split(/pedido/i)[1]?.trim() ?? "", quantity: null, movementType: null, ambiguous: false };
  }
  if (/\b(buscar|consultar|ver)\b.*\b(estoque|produto)\b/.test(lower)) {
    return { intent: "search_inventory", transcript: normalized, action: "Consultar estoque", entity: normalized.split(/estoque|produto/i)[1]?.trim() ?? "", quantity: null, movementType: null, ambiguous: false };
  }
  if (/\b(preparar|criar)\b.*\bmensagem\b/.test(lower)) {
    return { intent: "prepare_message", transcript: normalized, action: "Preparar mensagem", entity: "", quantity: null, movementType: null, ambiguous: false };
  }
  if (/\b(entrada|adicionar|sa[ií]da|retirar|perda)\b/.test(lower)) {
    const movementType = /\bentrada|adicionar\b/.test(lower) ? "purchase" : /\bperda\b/.test(lower) ? "loss" : "adjustment";
    const entity = normalized.replace(/\b(entrada|adicionar|sa[ií]da|retirar|perda)\b/gi, "").replace(/\b\d{1,6}\b/, "").trim();
    return { intent: "inventory_movement", transcript: normalized, action: "Preparar movimento de estoque", entity, quantity, movementType, ambiguous: !entity || !quantity };
  }
  return { intent: "unknown", transcript: normalized, action: "Revisar comando", entity: "", quantity, movementType: null, ambiguous: true };
}
