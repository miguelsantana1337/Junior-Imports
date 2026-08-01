export const STORE_TIME_ZONE = "America/Sao_Paulo";

export function formatMoney(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value) || 0);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: STORE_TIME_ZONE,
  }).format(new Date(value));
}

export function formatStoreDateKey(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: STORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function formatStoreHour(value: Date | string | number) {
  const date = value instanceof Date ? value : new Date(value);
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date));
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function whatsappUrl(phone: string, message = "") {
  const rawDigits = phone.replace(/\D/g, "");
  const digits = rawDigits.length === 10 || rawDigits.length === 11
    ? `55${rawDigits}`
    : rawDigits;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function formatWhatsappDisplay(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length === 11) return `(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  if (national.length === 10) return `(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  return phone.trim();
}
