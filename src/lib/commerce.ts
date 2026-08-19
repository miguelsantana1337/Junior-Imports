import type {
  CartCalculation,
  CartLine,
  CashbackCampaign,
  Coupon,
  PaymentMethod,
  ShippingDestination,
  ShippingStatus,
  StorefrontProduct,
  StoreSettings,
} from "@/types/store";
import { isPixDiscountEligible, isStorePromotionRuleActive } from "@/lib/store-promotion";

function normalizeShippingText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("pt-BR");
}

export function resolveShipping(
  settings: StoreSettings,
  subtotal: number,
  afterDiscounts: number,
  destination?: ShippingDestination,
): { amount: number; status: ShippingStatus } {
  if (subtotal <= 0) return { amount: 0, status: "pending" };
  if (destination?.deliveryMethod === "pickup") {
    return { amount: 0, status: "pickup" };
  }
  if (settings.freeShippingEnabled && isStorePromotionRuleActive(settings) && afterDiscounts >= settings.freeShippingThreshold) {
    return { amount: 0, status: "free" };
  }

  const city = normalizeShippingText(destination?.city);
  const state = destination?.state?.trim().toUpperCase() ?? "";
  const cityRates = settings.shippingCityRates ?? [];

  if (cityRates.length > 0 && !city) return { amount: 0, status: "pending" };

  const cityRate = cityRates.find((rate) => {
    const matchesCity = normalizeShippingText(rate.city) === city;
    const configuredState = rate.state.trim().toUpperCase();
    return matchesCity && (!configuredState || configuredState === state);
  });
  if (cityRate) return { amount: Math.max(0, cityRate.amount), status: "calculated" };

  if (cityRates.length > 0 && settings.quoteShippingOutsideCities) {
    return { amount: 0, status: "quote" };
  }

  return { amount: Math.max(0, settings.shippingFlat), status: "calculated" };
}

export function isCouponValid(coupon: Coupon, subtotal: number, now = new Date()) {
  if (!coupon.active || subtotal < coupon.minimum) return false;
  if (coupon.totalUsageLimit > 0 && coupon.usageCount >= coupon.totalUsageLimit) return false;
  if (coupon.startsAt && new Date(`${coupon.startsAt}T00:00:00`) > now) return false;
  if (!coupon.expiresAt) return true;
  const expiration = new Date(`${coupon.expiresAt}T23:59:59`);
  return expiration >= now;
}

export function calculateCart(
  lines: CartLine[],
  products: StorefrontProduct[],
  settings: StoreSettings,
  coupon: Coupon | null = null,
  payment?: PaymentMethod,
  activeCashbackCampaigns: CashbackCampaign[] = [],
  destination?: ShippingDestination,
): CartCalculation {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const validLines = lines.flatMap((line) => {
    const product = productMap.get(line.productId);
    if (!product || !product.active || line.quantity <= 0) return [];
    const quantity = Math.min(line.quantity, Math.max(product.stock, 0));
    return quantity > 0 ? [{ product, quantity, gross: product.price * quantity }] : [];
  });

  const subtotal = validLines.reduce((sum, line) => sum + line.gross, 0);

  let couponDiscount = 0;
  if (coupon && isCouponValid(coupon, subtotal)) {
    let applicableSubtotal = subtotal;
    
    const hasCategoryRestriction = coupon.applicableCategoryIds && coupon.applicableCategoryIds.length > 0;
    const hasProductRestriction = coupon.applicableProductIds && coupon.applicableProductIds.length > 0;
    
    if (hasCategoryRestriction || hasProductRestriction) {
      applicableSubtotal = validLines.reduce((sum, line) => {
        const { product } = line;
        const matchesCategory = hasCategoryRestriction ? coupon.applicableCategoryIds.includes(product.categoryId) : false;
        const matchesProduct = hasProductRestriction ? coupon.applicableProductIds.includes(product.id) : false;
        
        if (matchesCategory || matchesProduct) {
          return sum + line.gross;
        }
        return sum;
      }, 0);
    }

    if (applicableSubtotal >= coupon.minimum) {
      couponDiscount =
        coupon.type === "percent"
          ? applicableSubtotal * (coupon.value / 100)
          : Math.min(coupon.value, applicableSubtotal);
    }
  }

  const afterCoupon = Math.max(0, subtotal - couponDiscount);
  const paymentDiscount = payment === "Pix" && isPixDiscountEligible(settings, afterCoupon)
    ? afterCoupon * (settings.pixDiscount / 100)
    : 0;
  const afterDiscounts = Math.max(0, afterCoupon - paymentDiscount);
  const shipping = resolveShipping(settings, subtotal, afterDiscounts, destination);

  const campaign = [...activeCashbackCampaigns]
    .filter((item) => item.status === "active")
    .filter((item) => !item.startsAt || new Date(item.startsAt) <= new Date())
    .filter((item) => !item.endsAt || new Date(item.endsAt) >= new Date())
    .filter((item) => item.targetSegments.length === 0)
    .filter((item) => item.productIds.length === 0 || validLines.some((line) => item.productIds.includes(line.product.id)))
    .sort((left, right) => right.priority - left.priority)[0];
  const paidMerchandiseRatio = subtotal > 0 ? afterDiscounts / subtotal : 0;
  const cashbackByProduct: Record<string, number> = {};
  let campaignBonusApplied = false;

  for (const line of validLines) {
    const paidMerchandise = Math.max(0, line.gross * paidMerchandiseRatio);
    const campaignApplies = Boolean(campaign)
      && (campaign!.productIds.length === 0 || campaign!.productIds.includes(line.product.id));
    let lineCashback = 0;

    if (campaignApplies) {
      lineCashback = paidMerchandise * (campaign!.multiplier / 100);
      if (!campaignBonusApplied && paidMerchandise > 0 && campaign!.fixedBonus > 0) {
        lineCashback += campaign!.fixedBonus;
        campaignBonusApplied = true;
      }
    } else if (line.product.cashback > 0 && paidMerchandise > 0) {
      lineCashback = line.product.cashbackType === "percent"
        ? paidMerchandise * (line.product.cashback / 100)
        : line.product.cashback * line.quantity * (paidMerchandise / line.gross);
    }

    cashbackByProduct[line.product.id] = Number(lineCashback.toFixed(2));
  }

  const cashback = Number(Object.values(cashbackByProduct).reduce((sum, value) => sum + value, 0).toFixed(2));

  return {
    items: validLines.reduce((sum, line) => sum + line.quantity, 0),
    subtotal,
    couponDiscount,
    paymentDiscount,
    discount: couponDiscount + paymentDiscount,
    shipping: shipping.amount,
    shippingStatus: shipping.status,
    total: afterDiscounts + shipping.amount,
    cashback,
    cashbackByProduct,
  };
}

export function stockLabel(product: StorefrontProduct) {
  if (product.stock <= 0) return { label: "Esgotado", tone: "out" } as const;
  if (product.stock <= 5)
    return { label: "Últimas unidades", tone: "low" } as const;
  return { label: "Em estoque", tone: "ok" } as const;
}

export function discountPercent(product: StorefrontProduct) {
  if (product.compareAt <= product.price) return 0;
  return Math.round((1 - product.price / product.compareAt) * 100);
}
