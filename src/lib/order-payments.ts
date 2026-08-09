import { orderFinancialTotal } from "@/lib/order-finance";
import { orderPaymentStatus } from "@/lib/order-lifecycle";
import type { FinancialTransaction, Order } from "@/types/store";

export function orderPaymentHistory(orderId: string, transactions: FinancialTransaction[]) {
  const payments = transactions
    .filter((transaction) => transaction.orderId === orderId && transaction.type === "income")
    .sort((a, b) => new Date(b.paidAt || b.createdAt).getTime() - new Date(a.paidAt || a.createdAt).getTime());
  const hasInstallments = payments.some((payment) => payment.externalKey?.startsWith(`order-payment:${orderId}:`) || payment.id.startsWith(`order-payment-${orderId}-`));
  return payments.filter((payment) => !hasInstallments || (payment.externalKey !== `order-income:${orderId}` && payment.id !== `order-income-${orderId}`));
}

export function orderPaymentSummary(
  order: Pick<Order, "id" | "status" | "paymentStatus" | "amountPaid" | "total" | "financialTotal">,
  transactions: FinancialTransaction[],
) {
  const total = orderFinancialTotal(order);
  const history = orderPaymentHistory(order.id, transactions);
  const paidFromHistory = history
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + payment.amount, 0);
  const recordedPaid = Number(order.amountPaid);
  const paymentStatus = orderPaymentStatus(order);
  const historicalPaid = Number.isFinite(recordedPaid) && recordedPaid > 0
    ? recordedPaid
    : paidFromHistory > 0
      ? paidFromHistory
      : paymentStatus === "Recebido"
        ? total
        : 0;
  const effectivePaid = ["Estornado", "Cancelado"].includes(paymentStatus) ? 0 : historicalPaid;
  const paid = Math.min(total, Math.max(0, effectivePaid));
  return {
    total,
    paid,
    historicalPaid: Math.max(0, historicalPaid),
    remaining: Math.max(0, Math.round((total - paid) * 100) / 100),
    history,
  };
}

export function orderPaymentsRevenue(transactions: FinancialTransaction[], since: Date) {
  return transactions
    .filter((transaction) => transaction.type === "income" && transaction.status === "paid" && Boolean(transaction.orderId))
    .filter((transaction) => new Date(transaction.paidAt || transaction.createdAt) >= since)
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}
