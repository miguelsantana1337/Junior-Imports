"use client";

import {
  IconArrowRight,
  IconBox,
  IconClock,
  IconCommand,
  IconPackage,
  IconReceipt2,
  IconSearch,
  IconStar,
  IconStarFilled,
  IconUser,
  IconX,
  type TablerIcon,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { StoreData } from "@/types/store";

export interface AdminCommandSource {
  href: string;
  label: string;
  group: "Navegação" | "Criar";
  icon: TablerIcon;
  keywords?: string;
}

interface AdminCommandPaletteProps {
  open: boolean;
  onClose: () => void;
  data: StoreData;
  sources: AdminCommandSource[];
  favoriteHrefs: string[];
  onToggleFavorite: (href: string) => void;
}

type CommandGroup = AdminCommandSource["group"] | "Favoritos" | "Produtos" | "Pedidos" | "Clientes";

interface CommandEntry extends Omit<AdminCommandSource, "group"> {
  id: string;
  group: CommandGroup;
  description: string;
  favoriteAllowed: boolean;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function matches(entry: Pick<CommandEntry, "label" | "description" | "keywords">, query: string) {
  const haystack = normalize(`${entry.label} ${entry.description} ${entry.keywords ?? ""}`);
  return query.split(/\s+/).every((term) => haystack.includes(term));
}

export function AdminCommandPalette({ open, onClose, data, sources, favoriteHrefs, onToggleFavorite }: AdminCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const entries = useMemo(() => {
    const sourceEntries: CommandEntry[] = sources.map((source) => ({
      ...source,
      id: `${source.group}:${source.href}`,
      description: source.group === "Criar" ? "Abrir formulário de criação" : "Abrir área do painel",
      favoriteAllowed: source.group === "Navegação",
    }));
    const normalizedQuery = normalize(query);

    if (!normalizedQuery) {
      const favorites = favoriteHrefs
        .map((href) => sourceEntries.find((entry) => entry.href === href && entry.group === "Navegação"))
        .filter((entry): entry is CommandEntry => Boolean(entry));
      const remaining = sourceEntries.filter((entry) => !favorites.some((favorite) => favorite.href === entry.href));
      return [...favorites.map((entry) => ({ ...entry, group: "Favoritos" as const })), ...remaining].slice(0, 18);
    }

    const dynamicEntries: CommandEntry[] = [
      ...data.products.map((product) => ({
        id: `product:${product.id}`,
        href: `/admin/products/${encodeURIComponent(product.id)}`,
        label: product.name,
        group: "Produtos" as const,
        icon: IconPackage,
        description: `${product.sku || "Sem SKU"} · ${product.category} · ${product.stock} em estoque`,
        keywords: `${product.brand} ${product.badge}`,
        favoriteAllowed: false,
      })),
      ...data.orders.map((order) => ({
        id: `order:${order.id}`,
        href: `/admin/orders?q=${encodeURIComponent(order.code)}`,
        label: order.code,
        group: "Pedidos" as const,
        icon: IconReceipt2,
        description: `${order.customer.name} · ${order.status}`,
        keywords: `${order.customer.email} ${order.customer.phone}`,
        favoriteAllowed: false,
      })),
      ...data.customers.map((customer) => ({
        id: `customer:${customer.id}`,
        href: `/admin/customers?q=${encodeURIComponent(customer.name)}`,
        label: customer.name,
        group: "Clientes" as const,
        icon: IconUser,
        description: customer.email || customer.phone || "Cliente cadastrado",
        keywords: `${customer.phone} ${customer.tags.join(" ")}`,
        favoriteAllowed: false,
      })),
    ];

    return [...sourceEntries, ...dynamicEntries].filter((entry) => matches(entry, normalizedQuery)).slice(0, 24);
  }, [data.customers, data.orders, data.products, favoriteHrefs, query, sources]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => setActiveIndex(0), [query]);

  if (!open) return null;

  const executeActive = () => {
    const active = entries[activeIndex];
    if (!active) return;
    router.push(active.href);
    onClose();
  };

  return (
    <div className="admin-command-dialog" role="dialog" aria-modal="true" aria-label="Central de comandos">
      <button className="admin-command-backdrop" onClick={onClose} aria-label="Fechar central de comandos" />
      <section className="admin-command-palette">
        <header>
          <IconSearch />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => entries.length ? (index + 1) % entries.length : 0); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => entries.length ? (index - 1 + entries.length) % entries.length : 0); }
              if (event.key === "Enter") { event.preventDefault(); executeActive(); }
              if (event.key === "Escape") onClose();
            }}
            placeholder="Busque uma área, produto, pedido, cliente ou ação..."
            aria-label="Buscar na central de comandos"
            aria-controls="admin-command-results"
            aria-activedescendant={entries[activeIndex]?.id}
            autoComplete="off"
          />
          <kbd>ESC</kbd>
          <button onClick={onClose} aria-label="Fechar"><IconX /></button>
        </header>

        <div className="admin-command-results" id="admin-command-results" role="listbox">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            const isFavorite = favoriteHrefs.includes(entry.href);
            return (
              <div className={`admin-command-result ${index === activeIndex ? "active" : ""}`} id={entry.id} role="option" aria-selected={index === activeIndex} key={entry.id} onMouseEnter={() => setActiveIndex(index)}>
                <Link href={entry.href} onClick={onClose}>
                  <span className="admin-command-result-icon"><Icon stroke={1.8} /></span>
                  <span><small>{entry.group}</small><strong>{entry.label}</strong><em>{entry.description}</em></span>
                  <IconArrowRight className="admin-command-result-arrow" />
                </Link>
                {entry.favoriteAllowed && <button className="admin-command-favorite" onClick={() => onToggleFavorite(entry.href)} aria-label={isFavorite ? `Remover ${entry.label} dos favoritos` : `Favoritar ${entry.label}`} title={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}>{isFavorite ? <IconStarFilled /> : <IconStar />}</button>}
              </div>
            );
          })}
          {!entries.length && <div className="admin-command-empty"><IconBox /><strong>Nenhum resultado encontrado</strong><span>Tente buscar pelo nome, SKU, pedido, cliente ou área do painel.</span></div>}
        </div>

        <footer>
          <span><IconCommand /> Central de comandos</span>
          <div><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span><IconClock /> preferências salvas neste dispositivo</span></div>
        </footer>
      </section>
    </div>
  );
}
