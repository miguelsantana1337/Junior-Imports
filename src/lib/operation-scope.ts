import type { FinancialTransaction, Order, StoreData, StoreSettings } from "@/types/store";

type CreatedRecord = { createdAt: string };

export function operationStartTime(settings: Pick<StoreSettings, "operationStartedAt">) {
  const timestamp = new Date(settings.operationStartedAt).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function isOfficialOperationRecord(
  record: CreatedRecord,
  settings: Pick<StoreSettings, "operationStartedAt">,
) {
  const start = operationStartTime(settings);
  if (start === null) return true;
  const createdAt = new Date(record.createdAt).getTime();
  return Number.isFinite(createdAt) && createdAt >= start;
}

export function officialOrders(
  orders: Order[],
  settings: Pick<StoreSettings, "operationStartedAt">,
) {
  return orders.filter((order) => isOfficialOperationRecord(order, settings));
}

export function historicalOrders(
  orders: Order[],
  settings: Pick<StoreSettings, "operationStartedAt">,
) {
  const start = operationStartTime(settings);
  if (start === null) return [];
  return orders.filter((order) => !isOfficialOperationRecord(order, settings));
}

export function officialFinancialTransactions(
  transactions: FinancialTransaction[],
  settings: Pick<StoreSettings, "operationStartedAt">,
) {
  return transactions.filter((transaction) => isOfficialOperationRecord(transaction, settings));
}

export function historicalFinancialTransactions(
  transactions: FinancialTransaction[],
  settings: Pick<StoreSettings, "operationStartedAt">,
) {
  const start = operationStartTime(settings);
  if (start === null) return [];
  return transactions.filter((transaction) => !isOfficialOperationRecord(transaction, settings));
}

export function officialOperationData(data: StoreData): StoreData {
  return {
    ...data,
    orders: officialOrders(data.orders, data.settings),
    financialTransactions: officialFinancialTransactions(data.financialTransactions, data.settings),
  };
}

export function operationStartLabel(
  settings: Pick<StoreSettings, "operationStartedAt">,
) {
  const start = operationStartTime(settings);
  if (start === null) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(start));
}
