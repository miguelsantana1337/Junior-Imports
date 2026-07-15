"use client";

import { ChevronLeft, ChevronRight, Save, Search, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/store";
import { useAdminDialog } from "./use-admin-dialog";

const statuses: OrderStatus[] = ["Novo", "Aguardando pagamento", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"];

export function OrdersAdmin() {
  const { data } = useAdminData();
  const [selected, setSelected] = useState<Order | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => data.orders.filter((order) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const matches = !normalized || `${order.code} ${order.customer.name} ${order.customer.email} ${order.customer.phone}`.toLocaleLowerCase("pt-BR").includes(normalized);
    return matches && (status === "all" || order.status === status);
  }), [data.orders, query, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);

  return (
    <>
      <AdminPanel title="Pedidos demonstrativos" description="Localize pedidos, acompanhe o status e consulte o histórico do checkout.">
        <div className="admin-list-toolbar">
          <label className="admin-search-field"><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por pedido, cliente, e-mail ou telefone" aria-label="Buscar pedidos" /></label>
          <label><span>Status</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Todos</option>{statuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <strong>{filtered.length} pedido{filtered.length === 1 ? "" : "s"}</strong>
        </div>
        {visible.length ? (
          <>
            <div className="admin-table-wrap admin-orders-desktop"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Pagamento</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>{visible.map((order) => <tr key={order.id}><td><strong>{order.code}</strong></td><td><div className="admin-customer-cell"><strong>{order.customer.name}</strong><small>{order.customer.email}</small></div></td><td>{formatDateTime(order.createdAt)}</td><td>{order.payment === "Cartao" ? "Cartão" : order.payment}</td><td>{formatMoney(order.total)}</td><td><StatusTag active={order.status !== "Cancelado"}>{order.status}</StatusTag></td><td><button className="admin-button" onClick={() => setSelected(order)}>Abrir <ChevronRight /></button></td></tr>)}</tbody></table></div>
            <div className="admin-mobile-cards">{visible.map((order) => <article key={order.id}><header><div><strong>{order.code}</strong><small>{formatDateTime(order.createdAt)}</small></div><StatusTag active={order.status !== "Cancelado"}>{order.status}</StatusTag></header><div><strong>{order.customer.name}</strong><small>{order.customer.email}</small></div><footer><b>{formatMoney(order.total)}</b><button className="admin-button" onClick={() => setSelected(order)}>Abrir pedido <ChevronRight /></button></footer></article>)}</div>
            <div className="admin-pagination"><span>Página {currentPage} de {pageCount}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior"><ChevronLeft /></button><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Próxima página"><ChevronRight /></button></div></div>
          </>
        ) : <AdminEmpty><strong>Nenhum pedido encontrado.</strong><span>Ajuste os filtros ou faça uma compra demonstrativa na loja.</span></AdminEmpty>}
      </AdminPanel>
      {selected && <OrderDetail order={data.orders.find((order) => order.id === selected.id) ?? selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const { data, updateOrderStatus, saveOrderDetails } = useAdminData();
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [internalNotes, setInternalNotes] = useState(order.internalNotes);
  const [trackingCode, setTrackingCode] = useState(order.trackingCode);
  const [error, setError] = useState("");
  const panelRef = useAdminDialog(onClose);
  const matchingAutomations = data.messageAutomations.filter((automation) => automation.active && automation.triggerStatus === status).length;
  return <div className="admin-modal" role="dialog" aria-modal="true" aria-label={`Pedido ${order.code}`}><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel" ref={panelRef}><header><div><span>PEDIDO</span><h2>{order.code}</h2><small>{formatDateTime(order.createdAt)}</small></div><button type="button" onClick={onClose} aria-label="Fechar"><X /></button></header><div className="order-details"><section><h3>Cliente</h3><p><strong>{order.customer.name}</strong></p><p>{order.customer.email}</p><p>{order.customer.phone}</p><p>{order.customer.address}, {order.customer.number}</p><p>{order.customer.city}/{order.customer.state} · CEP {order.customer.zip}</p><Link className="admin-button" href="/admin/customers"><UserRound /> Abrir no CRM</Link></section><section><h3>Resumo</h3>{order.items.map((item) => <div className="order-item" key={`${item.productId}-${item.name}`}><span>{item.quantity}x {item.name}</span><strong>{formatMoney(item.unitPrice * item.quantity)}</strong></div>)}<div className="order-item"><span>Desconto</span><strong>- {formatMoney(order.discount)}</strong></div><div className="order-item"><span>Frete</span><strong>{formatMoney(order.shipping)}</strong></div><div className="order-item total"><span>Total</span><strong>{formatMoney(order.total)}</strong></div></section></div><div className="order-management-fields"><label>Código de rastreamento<input value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Opcional" /></label><label>Observações internas<textarea rows={3} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Informações visíveis apenas para a equipe" /></label><button className="admin-button" disabled={savingDetails || (trackingCode === order.trackingCode && internalNotes === order.internalNotes)} onClick={async () => { setSavingDetails(true); try { await saveOrderDetails(order.id, { trackingCode, internalNotes }); } finally { setSavingDetails(false); } }}><Save /> {savingDetails ? "Salvando..." : "Salvar detalhes"}</button></div>{error && <p className="admin-form-error order-update-error" role="alert">{error}</p>}<div className="order-status-editor"><div className="order-automation-hint"><strong>{matchingAutomations ? `${matchingAutomations} mensagem automática será registrada` : "Nenhuma automação para este status"}</strong><span>Os disparos deste projeto são demonstrativos.</span></div><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><button className="admin-button primary" disabled={saving || status === order.status} onClick={async () => { setSaving(true); setError(""); try { await updateOrderStatus(order.id, status); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o pedido."); } finally { setSaving(false); } }}>{saving ? "Atualizando..." : "Atualizar e automatizar"}</button></div></div></div>;
}
