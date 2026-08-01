import { formatMoney } from "./format";
import type { StoreSettings } from "@/types/store";

type AnnouncementSettings = Pick<
  StoreSettings,
  "announcement" | "freeShippingEnabled" | "freeShippingThreshold" | "shippingCityRates"
>;

const legacyFreeShippingAnnouncement = "frete grátis em compras acima de {{valor}}";

function normalizeAnnouncement(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR").replace(/[.!]+$/, "");
}

export function resolveStoreAnnouncement(settings: AnnouncementSettings) {
  const shippingValue = formatMoney(settings.freeShippingThreshold);
  const lowestCityShipping = settings.shippingCityRates.length
    ? Math.min(...settings.shippingCityRates.map((rate) => rate.amount))
    : null;
  const isLegacyFreeShippingText = normalizeAnnouncement(settings.announcement) === legacyFreeShippingAnnouncement;
  const template = !settings.freeShippingEnabled && lowestCityShipping !== null && isLegacyFreeShippingText
    ? "Frete local a partir de {{frete}} · Demais cidades sob cotação"
    : settings.announcement;

  return template
    .replaceAll("{{valor}}", shippingValue)
    .replaceAll("{{frete}}", lowestCityShipping === null ? "sob cotação" : formatMoney(lowestCityShipping))
    .replace(/(frete grátis.*?acima de)\s*R\$\s*[\d.,]+/i, `$1 ${shippingValue}`);
}
