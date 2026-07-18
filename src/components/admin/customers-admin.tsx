"use client";

import { CalendarClock, ChevronRight, MessageCircle, Search, ShoppingBag, UserRound, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { buildCustomerInsights, customerMatchesOrder, customerRecurrenceRate } from "@/lib/crm";
import { formatDateTime, formatMoney, whatsappUrl } from "@/lib/format";
import { customerSchema } from "@/lib/validation";
import type { Customer, CustomerInsight, CustomerSegment } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel } from "./admin-ui";
import { useAdminDialog } from "./use-admin-dialog";

const segmentLabels: Record<CustomerSegment, string> = {
  new: "Novo",
  active: "Ativo",
  recurring: "Recorrente",
  vip: "VIP",
  at_risk: "Em risco",
  inactive: "Inativo",
};

const sourceLabels: Record<Customer["source"], string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  referral: "Indicação",
  other: "Outro",
};

export function CustomersAdmin() {
  const { data } = useAdminData();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [segment, setSegment] = useState<CustomerSegment | "all">("all");
  const [selected, setSelected] = useState<CustomerInsight | null>(null);
  useEffect(() => { const externalQuery = searchParams.get("q"); if (externalQuery !== null) setQuery(externalQuery); }, [searchParams]);
  const insights = useMemo(() => buildCustomerInsights(data.customers, data.orders), [data.customers, data.orders]);
  const filtered = useMemo(() => insights.filter((customer) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !normalized || `${customer.name} ${customer.email} ${customer.phone} ${customer.tags.join(" ")}`.toLocaleLowerCase("pt-BR").includes(normalized);
    return matchesQuery && (segment === "all" || customer.segment === segment);
  }), [insights, query, segment]);
  const recurring = insights.filter((customer) => customer.orderCount > 1).length;
  const atRisk = insights.filter((customer) => ["at_risk", "inactive"].includes(customer.segment)).length;
  const totalRevenue = insights.reduce((sum, customer) => sum + customer.totalSpent, 0);

  return <>
    <section className="crm-summary-grid" aria-label="Resumo do CRM">
      <article><UsersRound /><div><span>Clientes</span><strong>{insights.length}</strong><small>cadastros identificados</small></div></article>
      <article><ShoppingBag /><div><span>Recorrentes</span><strong>{recurring}</strong><small>{customerRecurrenceRate(insights).toFixed(0)}% de recompra</small></div></article>
      <article><CalendarClock /><div><span>Precisam de contato</span><strong>{atRisk}</strong><small>em risco ou inativos</small></div></article>
      <article><UserRound /><div><span>Valor por cliente</span><strong>{formatMoney(insights.length ? totalRevenue / insights.length : 0)}</strong><small>média acumulada</small></div></article>
    </section>

    <AdminPanel title="Clientes e relacionamento" description="Acompanhe compras, frequência, valor e oportunidades de recompra.">
      <div className="admin-list-toolbar crm-toolbar">
        <label className="admin-search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, e-mail, telefone ou etiqueta" aria-label="Buscar clientes" /></label>
        <label><span>Segmento</span><select value={segment} onChange={(event) => setSegment(event.target.value as CustomerSegment | "all")}><option value="all">Todos</option>{Object.entries(segmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <strong>{filtered.length} cliente{filtered.length === 1 ? "" : "s"}</strong>
      </div>

      {filtered.length ? <>
        <div className="admin-table-wrap crm-desktop-table"><table className="admin-table"><thead><tr><th>Cliente</th><th>Segmento</th><th>Pedidos</th><th>Total gasto</th><th>Ticket médio</th><th>Última compra</th><th>Ação</th></tr></thead><tbody>{filtered.map((customer) => <tr key={customer.id}><td><div className="admin-customer-cell"><strong>{customer.name}</strong><small>{customer.phone || customer.email}</small></div></td><td><span className={`crm-segment ${customer.segment}`}>{segmentLabels[customer.segment]}</span></td><td>{customer.orderCount}</td><td><strong>{formatMoney(customer.totalSpent)}</strong></td><td>{formatMoney(customer.averageTicket)}</td><td>{customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : "Sem compras"}</td><td><button className="admin-button" onClick={() => setSelected(customer)}>Abrir <ChevronRight /></button></td></tr>)}</tbody></table></div>
        <div className="admin-mobile-cards crm-mobile-cards">{filtered.map((customer) => <article key={customer.id}><header><div><strong>{customer.name}</strong><small>{customer.phone || customer.email}</small></div><span className={`crm-segment ${customer.segment}`}>{segmentLabels[customer.segment]}</span></header><div className="crm-card-metrics"><span><b>{customer.orderCount}</b> pedidos</span><span><b>{formatMoney(customer.totalSpent)}</b> total</span></div><footer><small>{customer.lastOrderAt ? `Última compra ${formatDateTime(customer.lastOrderAt)}` : "Sem compras"}</small><button className="admin-button" onClick={() => setSelected(customer)}>Ver cliente <ChevronRight /></button></footer></article>)}</div>
      </> : <AdminEmpty><UsersRound /><strong>Nenhum cliente encontrado.</strong><span>Ajuste os filtros ou aguarde novos pedidos.</span></AdminEmpty>}
    </AdminPanel>
    {selected && <CustomerDetail customer={insights.find((item) => item.id === selected.id) ?? selected} onClose={() => setSelected(null)} />}
  </>;
}

function CustomerDetail({ customer, onClose }: { customer: CustomerInsight; onClose: () => void }) {
  const { data, saveCustomer } = useAdminData();
  const [form, setForm] = useState<Customer>({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    city: customer.city,
    state: customer.state,
    source: customer.source,
    tags: customer.tags,
    notes: customer.notes,
    assignedTo: customer.assignedTo,
    whatsappConsent: customer.whatsappConsent,
    emailConsent: customer.emailConsent,
    createdAt: customer.createdAt || new Date().toISOString(),
    updatedAt: customer.updatedAt || new Date().toISOString(),
  });
  const [tags, setTags] = useState(customer.tags.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useAdminDialog(onClose);
  const orders = data.orders.filter((order) => customerMatchesOrder(customer, order)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const field = <K extends keyof Customer>(key: K, value: Customer[K]) => setForm((current) => ({ ...current, [key]: value }));

  return <div className="admin-modal" role="dialog" aria-modal="true" aria-label={`Cliente ${customer.name}`}><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel crm-customer-panel" ref={panelRef}>
    <header><div><span>CLIENTE</span><h2>{customer.name}</h2><small><span className={`crm-segment ${customer.segment}`}>{segmentLabels[customer.segment]}</span> · {customer.orderCount} pedido{customer.orderCount === 1 ? "" : "s"}</small></div><button onClick={onClose} aria-label="Fechar"><X /></button></header>
    <div className="crm-detail-metrics"><article><span>Total gasto</span><strong>{formatMoney(customer.totalSpent)}</strong></article><article><span>Ticket médio</span><strong>{formatMoney(customer.averageTicket)}</strong></article><article><span>Frequência</span><strong>{customer.averageDaysBetweenOrders ? `${customer.averageDaysBetweenOrders} dias` : "Primeira compra"}</strong></article><article><span>Última compra</span><strong>{customer.daysSinceLastOrder} dias atrás</strong></article></div>
    <div className="crm-detail-grid">
      <form className="admin-form crm-customer-form" onSubmit={async (event) => { event.preventDefault(); const nextCustomer = { ...form, tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean), updatedAt: new Date().toISOString() }; const parsed = customerSchema.safeParse(nextCustomer); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os dados do cliente."); return; } setError(""); setSaving(true); try { await saveCustomer(nextCustomer); onClose(); } finally { setSaving(false); } }}>
        <label>Nome<input value={form.name} onChange={(event) => field("name", event.target.value)} required /></label>
        <label>WhatsApp<input value={form.phone} onChange={(event) => field("phone", event.target.value)} /></label>
        <label className="full">E-mail<input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} /></label>
        <label>Cidade<input value={form.city} onChange={(event) => field("city", event.target.value)} /></label>
        <label>Estado<input value={form.state} maxLength={2} onChange={(event) => field("state", event.target.value.toUpperCase())} /></label>
        <label className="full">Origem<select value={form.source} onChange={(event) => field("source", event.target.value as Customer["source"])}>{Object.entries(sourceLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="full">Responsável pelo relacionamento<input value={form.assignedTo} onChange={(event) => field("assignedTo", event.target.value)} placeholder="Nome ou e-mail do responsável" /></label>
        <label className="full">Etiquetas<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="VIP, indicação, recompra" /><small>Separe as etiquetas por vírgulas.</small></label>
        <div className="ops-consent-grid full">
          <label><input type="checkbox" checked={form.whatsappConsent} onChange={(event) => field("whatsappConsent", event.target.checked)} /><span><strong>WhatsApp autorizado</strong><small>Permite contatos comerciais por WhatsApp.</small></span></label>
          <label><input type="checkbox" checked={form.emailConsent} onChange={(event) => field("emailConsent", event.target.checked)} /><span><strong>E-mail autorizado</strong><small>Permite campanhas e contatos por e-mail.</small></span></label>
        </div>
        <label className="full">Observações internas<textarea rows={5} value={form.notes} onChange={(event) => field("notes", event.target.value)} placeholder="Preferências, contexto do atendimento e próximos passos" /></label>
        {error && <p className="admin-form-error full" role="alert">{error}</p>}
        <div className="admin-form-actions full"><a className="admin-button" href={whatsappUrl(form.phone, `Olá, ${form.name}! Tudo bem?`)} target="_blank" rel="noreferrer"><MessageCircle /> Abrir WhatsApp</a><button className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar cliente"}</button></div>
      </form>
      <section className="crm-order-history"><h3>Histórico de pedidos</h3>{orders.map((order) => <article key={order.id}><div><strong>{order.code}</strong><small>{formatDateTime(order.createdAt)} · {order.status}</small></div><b>{formatMoney(order.total)}</b></article>)}{!orders.length && <p>Nenhum pedido vinculado.</p>}{customer.favoriteProducts.length > 0 && <div className="crm-favorites"><strong>Produtos mais comprados</strong><span>{customer.favoriteProducts.join(" · ")}</span></div>}</section>
    </div>
  </div></div>;
}
