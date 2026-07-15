import { normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/crm";
import type { Coupon, CouponRedemption, Order, OrderCustomer } from "@/types/store";

export type CouponEligibility = { valid: true } | { valid: false; message: string };

function sameIdentity(customer: Pick<OrderCustomer, "email" | "phone">, email: string, phone: string) {
  return Boolean(
    (email && normalizeCustomerEmail(customer.email) === email)
    || (phone && normalizeCustomerPhone(customer.phone) === phone),
  );
}

export function validateCouponForCustomer(
  coupon: Coupon,
  customer: Pick<OrderCustomer, "email" | "phone">,
  orders: Order[],
  redemptions: CouponRedemption[],
  now = new Date(),
): CouponEligibility {
  const email = normalizeCustomerEmail(customer.email);
  const phone = normalizeCustomerPhone(customer.phone);
  if (!coupon.active) return { valid: false, message: "Este cupom não está ativo." };
  if (coupon.startsAt && new Date(`${coupon.startsAt}T00:00:00`) > now) return { valid: false, message: "Este cupom ainda não está disponível." };
  if (coupon.expiresAt && new Date(`${coupon.expiresAt}T23:59:59`) < now) return { valid: false, message: "Este cupom expirou." };

  const activeRedemptions = redemptions.filter((item) => item.couponId === coupon.id && item.status === "used");
  const totalUsage = Math.max(coupon.usageCount, activeRedemptions.length);
  if (coupon.totalUsageLimit > 0 && totalUsage >= coupon.totalUsageLimit) {
    return { valid: false, message: "O limite total de utilizações deste cupom foi atingido." };
  }

  const redemptionUsage = activeRedemptions.filter((item) => (
    (email && item.normalizedEmail === email) || (phone && item.normalizedPhone === phone)
  )).length;
  const legacyUsage = orders.filter((order) => (
    order.status !== "Cancelado"
    && order.couponCode.toUpperCase() === coupon.code.toUpperCase()
    && sameIdentity(order.customer, email, phone)
  )).length;
  const customerUsage = Math.max(redemptionUsage, legacyUsage);
  if (coupon.perCustomerLimit > 0 && customerUsage >= coupon.perCustomerLimit) {
    return { valid: false, message: "Este cupom já atingiu o limite de uso para este cliente." };
  }

  const previousOrders = orders.filter((order) => order.status !== "Cancelado" && sameIdentity(order.customer, email, phone));
  if (coupon.firstOrderOnly && previousOrders.length > 0) {
    return { valid: false, message: "Este cupom é válido somente para a primeira compra." };
  }

  return { valid: true };
}
