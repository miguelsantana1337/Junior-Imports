import { describe, expect, it, vi } from "vitest";
import { bcbDailyQuoteUrl, fetchLatestUsdBrlQuote, priceFromExchangeRate } from "./exchange-rate";

describe("exchange-rate", () => {
  it("calcula o preço proporcional sem arredondamento comercial oculto", () => {
    expect(priceFromExchangeRate(2_930, 5.1273, 5.1273)).toBe(2_930);
    expect(priceFromExchangeRate(2_930, 5, 5.25)).toBe(3_076.5);
  });

  it("consulta a PTAX do dia no formato aceito pelo Banco Central", () => {
    expect(bcbDailyQuoteUrl(new Date("2026-09-02T16:00:00Z"))).toContain("09-02-2026");
  });

  it("usa a cotação de venda mais recente do primeiro dia disponível", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [
        { cotacaoVenda: 5.1, dataHoraCotacao: "2026-09-01 10:00:00.000" },
        { cotacaoVenda: 5.157, dataHoraCotacao: "2026-09-01 13:00:00.000" },
      ] }), { status: 200 }));

    const quote = await fetchLatestUsdBrlQuote(new Date("2026-09-02T18:00:00Z"), fetcher as typeof fetch);
    expect(quote).toMatchObject({ rate: 5.157, rateDate: "2026-09-01", source: "BCB_PTAX_SELL" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("recusa valores cambiais fora da faixa de segurança", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ value: [
      { cotacaoVenda: 999, dataHoraCotacao: "2026-09-02 13:00:00.000" },
    ] }), { status: 200 }));
    await expect(fetchLatestUsdBrlQuote(new Date("2026-09-02T18:00:00Z"), fetcher as typeof fetch))
      .rejects.toThrow("cotação válida");
  });
});
