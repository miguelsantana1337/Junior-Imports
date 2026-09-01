"use client";

import { IconCalendarEvent, IconCheck, IconChevronDown } from "@tabler/icons-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  adminPeriodOptions,
  resolveAdminPeriod,
  type AdminPeriodPreset,
  type AdminPeriodRange,
} from "@/lib/admin-period";

interface AdminPeriodContextValue {
  preset: AdminPeriodPreset;
  range: AdminPeriodRange;
  maximumDate: string;
  optionRanges: Array<{ value: AdminPeriodPreset; label: string; range: AdminPeriodRange }>;
  setPreset: (preset: AdminPeriodPreset) => void;
  setCustomRange: (dateFrom: string, dateTo: string) => void;
}

const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null);

export function AdminPeriodProvider({
  preset,
  referenceNow,
  operationStartedAt,
  fallbackStartedAt,
  customDateFrom,
  customDateTo,
  onChange,
  children,
}: {
  preset: AdminPeriodPreset;
  referenceNow: number;
  operationStartedAt?: string;
  fallbackStartedAt?: string;
  customDateFrom?: string;
  customDateTo?: string;
  onChange: (preset: AdminPeriodPreset, customRange?: { dateFrom: string; dateTo: string }) => void;
  children: ReactNode;
}) {
  const range = useMemo(
    () => resolveAdminPeriod(preset, referenceNow, operationStartedAt, fallbackStartedAt, customDateFrom, customDateTo),
    [customDateFrom, customDateTo, fallbackStartedAt, operationStartedAt, preset, referenceNow],
  );
  const optionRanges = useMemo(
    () => adminPeriodOptions
      .filter((option) => option.value !== "custom")
      .map((option) => ({
        value: option.value,
        label: option.label,
        range: resolveAdminPeriod(option.value, referenceNow, operationStartedAt, fallbackStartedAt),
      })),
    [fallbackStartedAt, operationStartedAt, referenceNow],
  );
  const maximumDate = useMemo(() => resolveAdminPeriod("today", referenceNow).dateTo, [referenceNow]);
  const value = useMemo<AdminPeriodContextValue>(() => ({
    preset,
    range,
    maximumDate,
    optionRanges,
    setPreset: (nextPreset) => onChange(nextPreset),
    setCustomRange: (dateFrom, dateTo) => onChange("custom", { dateFrom, dateTo }),
  }), [maximumDate, onChange, optionRanges, preset, range]);
  return <AdminPeriodContext.Provider value={value}>{children}</AdminPeriodContext.Provider>;
}

export function useAdminPeriod() {
  const value = useContext(AdminPeriodContext);
  if (!value) throw new Error("useAdminPeriod precisa ser usado dentro de AdminPeriodProvider.");
  return value;
}

export function AdminPeriodSelector({ variant = "topbar" }: { variant?: "topbar" | "drawer" }) {
  const { preset, range, maximumDate, optionRanges, setPreset, setCustomRange } = useAdminPeriod();
  const [open, setOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(range.dateFrom);
  const [dateTo, setDateTo] = useState(range.dateTo);
  const rootRef = useRef<HTMLDivElement>(null);
  const invalidCustomRange = !dateFrom || !dateTo || dateFrom > dateTo || dateTo > maximumDate;

  useEffect(() => {
    if (!open) return;
    setDateFrom(range.dateFrom);
    setDateTo(range.dateTo);

    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open, range.dateFrom, range.dateTo]);

  const choosePreset = (nextPreset: AdminPeriodPreset) => {
    setPreset(nextPreset);
    setOpen(false);
  };

  return <div
    className={`admin-period-selector ${variant === "drawer" ? "is-drawer" : ""} ${open ? "is-open" : ""}`}
    ref={rootRef}
  >
    <button
      className="admin-period-trigger"
      type="button"
      onClick={() => setOpen((current) => !current)}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-label={`Dados exibidos: ${range.label}. ${range.dateLabel}`}
      title={`Filtrar dados: ${range.label} (${range.dateLabel})`}
    >
      <IconCalendarEvent aria-hidden="true" />
      <span><small>Dados exibidos</small><strong>{range.label}</strong></span>
      <em>{range.dateLabel}</em>
      <IconChevronDown className="admin-period-chevron" aria-hidden="true" />
    </button>

    {open && <section className="admin-period-popover" role="dialog" aria-label="Escolher período dos dados">
      <header>
        <div><strong>Qual período deseja analisar?</strong><p>Este filtro atualiza os números de todas as telas do painel.</p></div>
        <span>{range.dayCount} {range.dayCount === 1 ? "dia" : "dias"}</span>
      </header>

      <div className="admin-period-quick-options">
        {optionRanges.map((option) => <button
          type="button"
          key={option.value}
          className={preset === option.value ? "active" : ""}
          aria-pressed={preset === option.value}
          onClick={() => choosePreset(option.value)}
        >
          <span><strong>{option.label}</strong><small>{option.range.dateLabel}</small></span>
          {preset === option.value && <IconCheck aria-hidden="true" />}
        </button>)}
      </div>

      <form className={`admin-period-custom ${preset === "custom" ? "active" : ""}`} onSubmit={(event) => {
        event.preventDefault();
        if (invalidCustomRange) return;
        setCustomRange(dateFrom, dateTo);
        setOpen(false);
      }}>
        <div><strong>Escolher datas</strong><small>Use quando precisar conferir um intervalo específico.</small></div>
        <div className="admin-period-date-grid">
          <label><span>Data inicial</span><input type="date" value={dateFrom} max={dateTo || maximumDate} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label><span>Data final</span><input type="date" value={dateTo} min={dateFrom || undefined} max={maximumDate} onChange={(event) => setDateTo(event.target.value)} /></label>
        </div>
        {invalidCustomRange && <p className="admin-period-error">Informe uma data inicial anterior à data final e não use datas futuras.</p>}
        <button className="admin-button primary" type="submit" disabled={invalidCustomRange}>Aplicar período</button>
      </form>
    </section>}
  </div>;
}
