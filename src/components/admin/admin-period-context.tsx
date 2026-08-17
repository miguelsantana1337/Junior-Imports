"use client";

import { IconCalendarEvent } from "@tabler/icons-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import {
  adminPeriodOptions,
  resolveAdminPeriod,
  type AdminPeriodPreset,
  type AdminPeriodRange,
} from "@/lib/admin-period";

interface AdminPeriodContextValue {
  preset: AdminPeriodPreset;
  range: AdminPeriodRange;
  setPreset: (preset: AdminPeriodPreset) => void;
}

const AdminPeriodContext = createContext<AdminPeriodContextValue | null>(null);

export function AdminPeriodProvider({
  preset,
  referenceNow,
  operationStartedAt,
  fallbackStartedAt,
  onChange,
  children,
}: {
  preset: AdminPeriodPreset;
  referenceNow: number;
  operationStartedAt?: string;
  fallbackStartedAt?: string;
  onChange: (preset: AdminPeriodPreset) => void;
  children: ReactNode;
}) {
  const range = useMemo(
    () => resolveAdminPeriod(preset, referenceNow, operationStartedAt, fallbackStartedAt),
    [fallbackStartedAt, operationStartedAt, preset, referenceNow],
  );
  const value = useMemo(() => ({ preset, range, setPreset: onChange }), [onChange, preset, range]);
  return <AdminPeriodContext.Provider value={value}>{children}</AdminPeriodContext.Provider>;
}

export function useAdminPeriod() {
  const value = useContext(AdminPeriodContext);
  if (!value) throw new Error("useAdminPeriod precisa ser usado dentro de AdminPeriodProvider.");
  return value;
}

export function AdminPeriodSelector({ variant = "topbar" }: { variant?: "topbar" | "drawer" }) {
  const { preset, range, setPreset } = useAdminPeriod();
  return <label className={`admin-period-selector ${variant === "drawer" ? "is-drawer" : ""}`} title={`Período global: ${range.label}`}>
    <IconCalendarEvent aria-hidden="true" />
    <span>Período</span>
    <b>{range.shortLabel}</b>
    <select value={preset} onChange={(event) => setPreset(event.target.value as AdminPeriodPreset)} aria-label={variant === "drawer" ? "Período global do painel no menu" : "Período global do painel"}>
      {adminPeriodOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
    </select>
  </label>;
}
