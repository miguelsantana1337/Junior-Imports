import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import {
  historicalFinancialTransactions,
  historicalOrders,
  officialFinancialTransactions,
  officialOperationData,
  officialOrders,
  operationStartLabel,
} from "./operation-scope";

describe("marco da operação oficial", () => {
  it("mantém todos os registros quando não há data de início", () => {
    const data = cloneSeedData();
    data.settings.operationStartedAt = "";
    expect(officialOrders(data.orders, data.settings)).toHaveLength(data.orders.length);
    expect(officialFinancialTransactions(data.financialTransactions, data.settings)).toHaveLength(data.financialTransactions.length);
  });

  it("separa registros anteriores sem apagar cadastros ou cashback", () => {
    const data = cloneSeedData();
    data.settings.operationStartedAt = "2026-07-11T03:00:00.000Z";
    const scoped = officialOperationData(data);

    expect(scoped.orders.every((item) => new Date(item.createdAt) >= new Date(data.settings.operationStartedAt))).toBe(true);
    expect(scoped.financialTransactions.every((item) => new Date(item.createdAt) >= new Date(data.settings.operationStartedAt))).toBe(true);
    expect(historicalOrders(data.orders, data.settings).length + scoped.orders.length).toBe(data.orders.length);
    expect(historicalFinancialTransactions(data.financialTransactions, data.settings).length + scoped.financialTransactions.length).toBe(data.financialTransactions.length);
    expect(scoped.customers).toEqual(data.customers);
    expect(scoped.cashbackEntries).toEqual(data.cashbackEntries);
    expect(scoped.products).toEqual(data.products);
  });

  it("exibe a data no fuso da loja", () => {
    expect(operationStartLabel({ operationStartedAt: "2026-08-03T03:00:00.000Z" })).toBe("03/08/2026");
  });
});
