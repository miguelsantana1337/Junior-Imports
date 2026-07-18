import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import { buildReport, inventoryInsights, previousPeriod } from "./reporting";

describe("análises e relatórios", () => {
  it("calcula risco, cobertura e compra sugerida sem gerar valores negativos", () => {
    const data = cloneSeedData();
    const insights = inventoryInsights(data, 90, new Date("2026-07-18T12:00:00-03:00"));
    expect(insights).toHaveLength(data.products.filter((product) => product.active).length);
    expect(insights.every((item) => item.suggestedQuantity >= 0 && item.reorderPoint >= item.minStock)).toBe(true);
    expect(insights.find((item) => item.productId === "tg15")?.incomingUnits).toBe(5);
  });

  it("monta relatório de vendas com comparativo do período anterior", () => {
    const data = cloneSeedData();
    const report = buildReport(data, { type: "sales", dateFrom: "2026-07-10", dateTo: "2026-07-12", comparePrevious: true, filters: {} });
    expect(report.rows).toHaveLength(3);
    expect(report.metrics.find((metric) => metric.key === "revenue")?.value).toBeGreaterThan(0);
    expect(report.comparison.revenue).toBeDefined();
  });

  it("aplica filtros reutilizáveis ao conjunto e aos indicadores", () => {
    const report = buildReport(cloneSeedData(), { type: "sales", dateFrom: "2026-07-10", dateTo: "2026-07-12", comparePrevious: false, filters: { primary: "status:Pago" } });
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]?.status).toBe("Pago");
    expect(report.metrics.find((metric) => metric.key === "orders")?.value).toBe(1);
  });

  it("preserva a mesma quantidade de dias no período anterior", () => {
    expect(previousPeriod("2026-07-10", "2026-07-12")).toEqual({ dateFrom: "2026-07-07", dateTo: "2026-07-09" });
  });
});
