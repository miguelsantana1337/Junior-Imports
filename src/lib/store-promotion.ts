import type { StoreSettings } from "@/types/store";

function validDate(value: string) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

/** Campanha temporária visível ao cliente dentro da janela configurada. */
export function isStorePromotionActive(settings: StoreSettings, now = new Date()) {
  if (!settings.promotionEnabled) return false;
  const startsAt = validDate(settings.promotionStartsAt);
  const endsAt = validDate(settings.promotionEndsAt);
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
}

/**
 * Regras antigas continuam permanentes. Quando uma campanha temporária está
 * configurada, as condições comerciais expiram junto com a campanha.
 */
export function isStorePromotionRuleActive(settings: StoreSettings, now = new Date()) {
  return !settings.promotionEnabled || isStorePromotionActive(settings, now);
}

export function isPixDiscountEligible(settings: StoreSettings, merchandiseTotal: number, now = new Date()) {
  return settings.pixDiscount > 0
    && isStorePromotionRuleActive(settings, now)
    && merchandiseTotal >= settings.pixDiscountMinimum;
}

export function isCardInstallmentEligible(settings: StoreSettings, merchandiseTotal: number, now = new Date()) {
  return settings.cardInstallments > 1
    && isStorePromotionRuleActive(settings, now)
    && merchandiseTotal >= settings.cardInstallmentMinimum;
}
