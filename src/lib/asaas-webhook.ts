import { timingSafeEqual } from "node:crypto";

export function validAsaasWebhookToken(received: string | null, expected: string | undefined) {
  if (!received || !expected || expected.length < 32) return false;
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function asaasPaymentState(status: string): "paid" | "pending" | "refunded" | "review" {
  if (status === "RECEIVED" || status === "CONFIRMED") return "paid";
  if (status === "REFUNDED") return "refunded";
  if (["PENDING", "OVERDUE"].includes(status)) return "pending";
  return "review";
}
