import { describe, expect, it } from "vitest";
import {
  buildAdminPeriodBuckets,
  isInAdminPeriod,
  resolveAdminPeriod,
} from "./admin-period";

const referenceNow = "2026-08-16T15:00:00.000Z";

describe("período global do painel", () => {
  it("resolve hoje e a semana corrente no fuso da loja", () => {
    expect(resolveAdminPeriod("today", referenceNow).dateFrom).toBe("2026-08-16");
    expect(resolveAdminPeriod("week", referenceNow)).toMatchObject({
      dateFrom: "2026-08-10",
      dateTo: "2026-08-16",
      dayCount: 7,
    });
  });

  it("mantém os atalhos inclusivos de 15, 30 e 90 dias", () => {
    expect(resolveAdminPeriod("15d", referenceNow)).toMatchObject({ dateFrom: "2026-08-02", dayCount: 15 });
    expect(resolveAdminPeriod("30d", referenceNow)).toMatchObject({ dateFrom: "2026-07-18", dayCount: 30 });
    expect(resolveAdminPeriod("3m", referenceNow)).toMatchObject({ dateFrom: "2026-05-19", dayCount: 90 });
  });

  it("inicia Desde o início na base oficial ou no primeiro registro disponível", () => {
    expect(resolveAdminPeriod("all", referenceNow, "2026-08-03T03:00:00.000Z", "2025-01-01T12:00:00.000Z").dateFrom).toBe("2026-08-03");
    expect(resolveAdminPeriod("all", referenceNow, undefined, "2026-02-10T12:00:00.000Z").dateFrom).toBe("2026-02-10");
  });

  it("resolve um intervalo personalizado e limita datas futuras", () => {
    expect(resolveAdminPeriod("custom", referenceNow, undefined, undefined, "2026-08-03", "2026-08-12")).toMatchObject({
      label: "Período personalizado",
      dateFrom: "2026-08-03",
      dateTo: "2026-08-12",
      dateLabel: "03/08/2026 a 12/08/2026",
      dayCount: 10,
    });
    expect(resolveAdminPeriod("custom", referenceNow, undefined, undefined, "2026-08-15", "2026-09-01")).toMatchObject({
      dateFrom: "2026-08-15",
      dateTo: "2026-08-16",
    });
  });

  it("compara datas usando o dia comercial de São Paulo", () => {
    const range = resolveAdminPeriod("today", referenceNow);
    expect(isInAdminPeriod("2026-08-16T02:30:00.000Z", range)).toBe(false);
    expect(isInAdminPeriod("2026-08-16T03:00:00.000Z", range)).toBe(true);
  });

  it("gera no máximo quinze colunas para o gráfico", () => {
    const range = resolveAdminPeriod("3m", referenceNow);
    const buckets = buildAdminPeriodBuckets(range);
    expect(buckets).toHaveLength(15);
    expect(buckets[0]).toMatchObject({ dateFrom: "2026-05-19", dateTo: "2026-05-24" });
    expect(buckets.at(-1)?.dateTo).toBe("2026-08-16");
  });
});
