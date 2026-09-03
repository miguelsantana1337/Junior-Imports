export const USD_BRL_SOURCE = "BCB_PTAX_SELL";

export interface ExchangeRateQuote {
  rate: number;
  rateDate: string;
  quotedAt: string;
  source: typeof USD_BRL_SOURCE;
}

type BcbQuote = {
  cotacaoVenda?: unknown;
  dataHoraCotacao?: unknown;
};

function saoPauloDateParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return { year: read("year"), month: read("month"), day: read("day") };
}

function dateAtOffset(reference: Date, days: number) {
  return new Date(reference.getTime() - days * 86_400_000);
}

export function bcbDailyQuoteUrl(reference: Date) {
  const { year, month, day } = saoPauloDateParts(reference);
  const date = `${month}-${day}-${year}`;
  return `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${date}'&$format=json`;
}

export function priceFromExchangeRate(basePrice: number, baseRate: number, currentRate: number) {
  if (![basePrice, baseRate, currentRate].every(Number.isFinite) || basePrice < 0 || baseRate <= 0 || currentRate <= 0) {
    throw new Error("Dados cambiais inválidos.");
  }
  return Number((basePrice * currentRate / baseRate).toFixed(2));
}

export async function fetchLatestUsdBrlQuote(
  reference = new Date(),
  fetcher: typeof fetch = fetch,
): Promise<ExchangeRateQuote> {
  for (let offset = 0; offset <= 7; offset += 1) {
    const requestedDate = dateAtOffset(reference, offset);
    let response: Response;
    try {
      response = await fetcher(bcbDailyQuoteUrl(requestedDate), {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      continue;
    }
    if (!response.ok) continue;
    const payload = await response.json() as { value?: BcbQuote[] };
    const quotes = Array.isArray(payload.value) ? payload.value : [];
    const valid = quotes
      .map((quote) => ({
        rate: Number(quote.cotacaoVenda),
        quotedAt: String(quote.dataHoraCotacao ?? ""),
      }))
      .filter((quote) => Number.isFinite(quote.rate) && quote.rate >= 1 && quote.rate <= 20)
      .sort((left, right) => left.quotedAt.localeCompare(right.quotedAt));
    const latest = valid.at(-1);
    if (!latest) continue;
    const { year, month, day } = saoPauloDateParts(requestedDate);
    return {
      rate: latest.rate,
      rateDate: `${year}-${month}-${day}`,
      quotedAt: latest.quotedAt,
      source: USD_BRL_SOURCE,
    };
  }
  throw new Error("O Banco Central não retornou uma cotação válida nos últimos 7 dias.");
}
