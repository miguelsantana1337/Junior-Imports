"use client";

import { Search, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

export type AdminSearchOption = {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

export function AdminSearchSelect({
  label,
  value,
  options,
  placeholder,
  emptyMessage = "Nenhum resultado encontrado.",
  onChange,
}: {
  label: string;
  value: string;
  options: AdminSearchOption[];
  placeholder: string;
  emptyMessage?: string;
  onChange: (value: string) => void;
}) {
  const inputId = useId();
  const listId = `${inputId}-results`;
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) setQuery(selected?.label ?? "");
  }, [open, selected?.label]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const filtered = useMemo(() => {
    const term = normalizeSearch(query.trim());
    return options
      .filter((option) => !term || normalizeSearch(`${option.label} ${option.description ?? ""}`).includes(term))
      .slice(0, 30);
  }, [options, query]);

  function choose(option: AdminSearchOption) {
    if (option.disabled) return;
    onChange(option.value);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="admin-search-select" ref={rootRef}>
      <label htmlFor={inputId}>{label}</label>
      <div className="admin-search-select-control">
        <Search aria-hidden="true" />
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          value={query}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={(event) => { setOpen(true); setActiveIndex(0); event.currentTarget.select(); }}
          onBlur={() => window.setTimeout(() => { if (!rootRef.current?.contains(document.activeElement)) setOpen(false); }, 0)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); if (value) onChange(""); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && open && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex]); }
            if (event.key === "Escape") setOpen(false);
          }}
        />
        {query && <button type="button" onClick={() => { setQuery(""); onChange(""); setOpen(true); }} aria-label={`Limpar ${label.toLocaleLowerCase("pt-BR")}`}><X /></button>}
      </div>
      {open && (
        <div className="admin-search-select-results" id={listId} role="listbox">
          {filtered.length ? filtered.map((option, index) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={index === activeIndex ? "active" : ""}
              disabled={option.disabled}
              key={option.value}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => choose(option)}
            >
              <strong>{option.label}</strong>
              {option.description && <small>{option.description}</small>}
            </button>
          )) : <p>{emptyMessage}</p>}
        </div>
      )}
    </div>
  );
}
