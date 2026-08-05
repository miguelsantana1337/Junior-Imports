"use client";

import { EyeOff, MessageCircle, RefreshCw, RotateCcw, Search, ShoppingCart, UserRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";
import { ABANDONED_CART_AFTER_MINUTES, cartRecoveryMessage, trackedCartStatus } from "@/lib/abandoned-cart";
import { formatDateTime, formatMoney, whatsappUrl } from "@/lib/format";
import type { TrackedCart, TrackedCartStatus } from "@/types/abandoned-cart";

const statusLabels: Record<TrackedCartStatus, string> = {
  abandoned: "Abandonado",
  active: "Em andamento",
  recovered: "Convertido",
  dismissed: "Ignorado",
};

export function AbandonedCartsAdmin() {
  const { data, demoMode } = useAdminData();
  const [carts, setCarts] = useState<TrackedCart[]>([]);
  const [view, setView] = useState<TrackedCartStatus>("abandoned");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/abandoned-carts", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as { carts?: TrackedCart[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível carregar os carrinhos.");
      setCarts(payload?.carts ?? []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar os carrinhos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const monitored = useMemo(() => carts.map((cart) => ({ ...cart, status: trackedCartStatus(cart) })), [carts]);
  const counts = useMemo(() => ({
    abandoned: monitored.filter((cart) => cart.status === "abandoned").length,
    active: monitored.filter((cart) => cart.status === "active").length,
    recovered: monitored.filter((cart) => cart.status === "recovered").length,
    dismissed: monitored.filter((cart) => cart.status === "dismissed").length,
  }), [monitored]);
  const abandonedValue = monitored.filter((cart) => cart.status === "abandoned").reduce((sum, cart) => sum + cart.subtotal, 0);
  const recoverable = monitored.filter((cart) => cart.status === "abandoned" && cart.contactAllowed && cart.customerPhone).length;
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return monitored.filter((cart) => cart.status === view && (!term || `${cart.customerName} ${cart.customerPhone} ${cart.customerEmail} ${cart.items.map((item) => item.name).join(" ")}`.toLocaleLowerCase("pt-BR").includes(term)));
  }, [monitored, query, view]);

  async function updateStatus(cart: TrackedCart, action: "dismiss" | "restore") {
    setBusyId(cart.id);
    setError("");
    try {
      const response = await fetch("/api/admin/abandoned-carts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cart.id, action }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Não foi possível atualizar o carrinho.");
      setCarts((current) => current.map((item) => item.id === cart.id ? { ...item, status: action === "dismiss" ? "dismissed" : "active" } : item));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o carrinho.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <AdminPanel title="Carrinhos abandonados" description={`Detecta checkouts sem atividade há ${ABANDONED_CART_AFTER_MINUTES} minutos e permite recuperação manual pelo WhatsApp.`} action={<button className="admin-button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Atualizar</button>}>
      <div className="abandoned-cart-summary">
        <article><ShoppingCart /><span><small>Abandonados</small><strong>{counts.abandoned}</strong><p>{formatMoney(abandonedValue)} em potencial</p></span></article>
        <article><UserRound /><span><small>Com WhatsApp informado</small><strong>{recoverable}</strong><p>Prontos para atendimento</p></span></article>
        <article><RotateCcw /><span><small>Convertidos</small><strong>{counts.recovered}</strong><p>Viraram pedidos</p></span></article>
      </div>
      <div className="orders-view-switch abandoned-cart-tabs" role="tablist" aria-label="Situação dos carrinhos">
        {(["abandoned", "active", "recovered", "dismissed"] as const).map((status) => <button type="button" role="tab" aria-selected={view === status} className={view === status ? "active" : ""} onClick={() => setView(status)} key={status}>{statusLabels[status]} <span>{counts[status]}</span></button>)}
      </div>
      <div className="admin-list-toolbar"><label className="admin-search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cliente, WhatsApp ou produto" aria-label="Buscar carrinhos" /></label><strong>{filtered.length} carrinho{filtered.length === 1 ? "" : "s"}</strong></div>
      {error && <p className="admin-form-error abandoned-cart-error" role="alert">{error}</p>}
      {loading ? <div className="abandoned-cart-loading"><RefreshCw className="spin" /> Carregando carrinhos...</div> : filtered.length ? <>
        <div className="admin-table-wrap abandoned-cart-desktop"><table className="admin-table"><thead><tr><th>Cliente</th><th>Última atividade</th><th>Produtos</th><th>Valor estimado</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{filtered.map((cart) => <tr key={cart.id}><td><div className="admin-customer-cell"><strong>{cart.contactAllowed && cart.customerName ? cart.customerName : "Visitante sem contato"}</strong><small>{cart.contactAllowed ? cart.customerPhone || cart.customerEmail : "WhatsApp ainda não informado"}</small></div></td><td>{formatDateTime(cart.lastActivityAt)}</td><td><div className="abandoned-cart-items"><strong>{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</strong><small>{cart.items.map((item) => `${item.quantity}x ${item.name}`).join(" · ")}</small></div></td><td><strong>{formatMoney(cart.subtotal)}</strong></td><td><StatusTag active={cart.status === "active" || cart.status === "recovered"}>{statusLabels[cart.status]}</StatusTag></td><td><CartActions cart={cart} storeName={data.settings.storeName} busy={busyId === cart.id} onUpdate={updateStatus} /></td></tr>)}</tbody></table></div>
        <div className="admin-mobile-cards abandoned-cart-mobile">{filtered.map((cart) => <article key={cart.id}><header><div><strong>{cart.contactAllowed && cart.customerName ? cart.customerName : "Visitante sem contato"}</strong><small>{formatDateTime(cart.lastActivityAt)}</small></div><StatusTag active={cart.status === "active" || cart.status === "recovered"}>{statusLabels[cart.status]}</StatusTag></header><div><strong>{formatMoney(cart.subtotal)} · {cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</strong><small>{cart.items.map((item) => `${item.quantity}x ${item.name}`).join(" · ")}</small></div><footer><CartActions cart={cart} storeName={data.settings.storeName} busy={busyId === cart.id} onUpdate={updateStatus} /></footer></article>)}</div>
      </> : <AdminEmpty><ShoppingCart /><strong>{demoMode ? "Nenhum carrinho no ambiente local." : `Nenhum carrinho ${statusLabels[view].toLocaleLowerCase("pt-BR")}.`}</strong><span>{view === "abandoned" ? "Os checkouts sem atividade aparecerão automaticamente aqui." : "Altere a visualização para consultar outras situações."}</span></AdminEmpty>}
    </AdminPanel>
  );
}

function CartActions({ cart, storeName, busy, onUpdate }: { cart: TrackedCart; storeName: string; busy: boolean; onUpdate: (cart: TrackedCart, action: "dismiss" | "restore") => Promise<void> }) {
  const canContact = cart.status === "abandoned" && cart.contactAllowed && Boolean(cart.customerPhone);
  return <div className="admin-actions">{canContact && <a className="admin-button primary" href={whatsappUrl(cart.customerPhone, cartRecoveryMessage(cart, storeName))} target="_blank" rel="noreferrer"><MessageCircle /> Recuperar</a>}{cart.status === "dismissed" ? <button className="admin-button" disabled={busy} onClick={() => void onUpdate(cart, "restore")}><RotateCcw /> Restaurar</button> : cart.status !== "recovered" && <button className="admin-button" disabled={busy} onClick={() => void onUpdate(cart, "dismiss")}><EyeOff /> Ignorar</button>}</div>;
}
