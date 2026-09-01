import { formatStoreDateKey } from "@/lib/format";

export const adminPeriodPresets = ["today", "week", "15d", "30d", "3m", "all", "custom"] as const;

export type AdminPeriodPreset = (typeof adminPeriodPresets)[number];

export interface AdminPeriodRange {
  preset: AdminPeriodPreset;
  label: string;
  shortLabel: string;
  dateFrom: string;
  dateTo: string;
  dateLabel: string;
  dayCount: number;
  isAll: boolean;
}

export interface AdminPeriodBucket {
  key: string;
  dateFrom: string;
  dateTo: string;
  label: string;
  shortLabel: string;
}

export const adminPeriodOptions: ReadonlyArray<{ value: AdminPeriodPreset; label: string; shortLabel: string }> = [
  { value: "today", label: "Hoje", shortLabel: "Hoje" },
  { value: "week", label: "Esta semana", shortLabel: "Semana" },
  { value: "15d", label: "Últimos 15 dias", shortLabel: "15 dias" },
  { value: "30d", label: "Últimos 30 dias", shortLabel: "30 dias" },
  { value: "3m", label: "Últimos 3 meses", shortLabel: "3 meses" },
  { value: "all", label: "Desde o início", shortLabel: "Tudo" },
  { value: "custom", label: "Escolher datas", shortLabel: "Datas" },
];

const dayMs = 86_400_000;

export function isAdminPeriodPreset(value: unknown): value is AdminPeriodPreset {
  return typeof value === "string" && adminPeriodPresets.includes(value as AdminPeriodPreset);
}

function dateKeyTime(value: string) {
  const timestamp = new Date(`${value}T12:00:00.000Z`).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function addDaysToDateKey(value: string, days: number) {
  const timestamp = dateKeyTime(value);
  if (timestamp === null) return value;
  return new Date(timestamp + Math.trunc(days) * dayMs).toISOString().slice(0, 10);
}

export function daysBetweenDateKeys(from: string, to: string) {
  const fromTime = dateKeyTime(from);
  const toTime = dateKeyTime(to);
  if (fromTime === null || toTime === null) return 1;
  return Math.max(1, Math.floor((toTime - fromTime) / dayMs) + 1);
}

function firstValidDateKey(...values: Array<string | null | undefined>) {
  const value = values.find((item): item is string => typeof item === "string" && item.length > 0 && Number.isFinite(new Date(item).getTime()));
  return value ? formatStoreDateKey(value) : "2000-01-01";
}

function validDateKey(value: string | null | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return dateKeyTime(value) === null ? null : value;
}

export function formatAdminPeriodDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function formatAdminPeriodDateRange(dateFrom: string, dateTo: string) {
  return dateFrom === dateTo
    ? formatAdminPeriodDate(dateFrom)
    : `${formatAdminPeriodDate(dateFrom)} a ${formatAdminPeriodDate(dateTo)}`;
}

export function resolveAdminPeriod(
  preset: AdminPeriodPreset,
  referenceNow: Date | string | number,
  operationStartedAt?: string,
  fallbackStartedAt?: string,
  customDateFrom?: string,
  customDateTo?: string,
): AdminPeriodRange {
  const referenceDate = formatStoreDateKey(referenceNow);
  let dateTo = referenceDate;
  const option = adminPeriodOptions.find((item) => item.value === preset) ?? adminPeriodOptions[3];
  let dateFrom = dateTo;

  if (preset === "week") {
    const timestamp = dateKeyTime(dateTo) ?? 0;
    const weekday = new Date(timestamp).getUTCDay();
    dateFrom = addDaysToDateKey(dateTo, -(weekday === 0 ? 6 : weekday - 1));
  } else if (preset === "15d") {
    dateFrom = addDaysToDateKey(dateTo, -14);
  } else if (preset === "30d") {
    dateFrom = addDaysToDateKey(dateTo, -29);
  } else if (preset === "3m") {
    dateFrom = addDaysToDateKey(dateTo, -89);
  } else if (preset === "all") {
    dateFrom = firstValidDateKey(operationStartedAt, fallbackStartedAt);
  } else if (preset === "custom") {
    dateTo = validDateKey(customDateTo) ?? referenceDate;
    if (dateTo > referenceDate) dateTo = referenceDate;
    dateFrom = validDateKey(customDateFrom) ?? dateTo;
  }

  if (dateFrom > dateTo) dateFrom = dateTo;

  const dateLabel = formatAdminPeriodDateRange(dateFrom, dateTo);

  return {
    preset,
    label: preset === "custom" ? "Período personalizado" : option.label,
    shortLabel: preset === "custom" ? `${shortDateLabel(dateFrom)}–${shortDateLabel(dateTo)}` : option.shortLabel,
    dateFrom,
    dateTo,
    dateLabel,
    dayCount: daysBetweenDateKeys(dateFrom, dateTo),
    isAll: preset === "all",
  };
}

export function isInAdminPeriod(value: Date | string | number | null | undefined, range: Pick<AdminPeriodRange, "dateFrom" | "dateTo">) {
  if (value === null || value === undefined || value === "") return false;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const key = formatStoreDateKey(timestamp);
  return key >= range.dateFrom && key <= range.dateTo;
}

export function filterByAdminPeriod<T>(items: T[], getDate: (item: T) => Date | string | number | null | undefined, range: Pick<AdminPeriodRange, "dateFrom" | "dateTo">) {
  return items.filter((item) => isInAdminPeriod(getDate(item), range));
}

function shortDateLabel(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export function buildAdminPeriodBuckets(range: AdminPeriodRange, maximumBuckets = 15): AdminPeriodBucket[] {
  const bucketCount = Math.max(1, Math.min(maximumBuckets, range.dayCount));
  const bucketDays = Math.max(1, Math.ceil(range.dayCount / bucketCount));
  const buckets: AdminPeriodBucket[] = [];

  for (let dateFrom = range.dateFrom; dateFrom <= range.dateTo; dateFrom = addDaysToDateKey(dateFrom, bucketDays)) {
    const dateTo = [addDaysToDateKey(dateFrom, bucketDays - 1), range.dateTo].sort()[0];
    const daily = dateFrom === dateTo;
    buckets.push({
      key: dateFrom,
      dateFrom,
      dateTo,
      label: daily ? shortDateLabel(dateFrom) : `${shortDateLabel(dateFrom)}–${shortDateLabel(dateTo)}`,
      shortLabel: shortDateLabel(dateFrom),
    });
  }

  return buckets;
}
