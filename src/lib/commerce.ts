import type {
  CartCalculation,
  CartLine,
  Coupon,
  PaymentMethod,
  Product,
  StoreSettings,
} from "@/types/store";

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
  products: Product[],
  settings: StoreSettings,
  coupon: Coupon | null = null,
  payment?: PaymentMethod,
): CartCalculation {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const validLines = lines.filter((line) => {
    const product = productMap.get(line.productId);
    return product && product.active && line.quantity > 0;
  });

  const subtotal = validLines.reduce((sum, line) => {
    const product = productMap.get(line.productId)!;
    const safeQuantity = Math.min(line.quantity, Math.max(product.stock, 0));
    return sum + product.price * safeQuantity;
  }, 0);

  let couponDiscount = 0;
  if (coupon && isCouponValid(coupon, subtotal)) {
    couponDiscount =
      coupon.type === "percent"
        ? subtotal * (coupon.value / 100)
        : coupon.value;
    couponDiscount = Math.min(couponDiscount, subtotal);
  }

  const afterCoupon = Math.max(0, subtotal - couponDiscount);
  const paymentDiscount =
    payment === "Pix" ? afterCoupon * (settings.pixDiscount / 100) : 0;
  const afterDiscounts = Math.max(0, afterCoupon - paymentDiscount);
  const shipping =
    subtotal === 0 || (settings.freeShippingEnabled && afterDiscounts >= settings.freeShippingThreshold)
      ? 0
      : settings.shippingFlat;

  return {
    items: validLines.reduce((sum, line) => {
      const product = productMap.get(line.productId)!;
      return sum + Math.min(line.quantity, Math.max(product.stock, 0));
    }, 0),
    subtotal,
    couponDiscount,
    paymentDiscount,
    discount: couponDiscount + paymentDiscount,
    shipping,
    total: afterDiscounts + shipping,
  };
}

export function stockLabel(product: Product) {
  if (product.stock <= 0) return { label: "Esgotado", tone: "out" } as const;
  if (product.stock <= 10)
    return { label: `Só ${product.stock} unidades`, tone: "low" } as const;
  return { label: "Em estoque", tone: "ok" } as const;
}

export function discountPercent(product: Product) {
  if (product.compareAt <= product.price) return 0;
  return Math.round((1 - product.price / product.compareAt) * 100);
}
