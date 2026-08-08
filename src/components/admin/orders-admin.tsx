"use client";

import { Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight, CircleDollarSign, MessageCircle, MoreVertical, PackagePlus, Plus, Save, Search, Trash2, Truck, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";
import { calculateCart } from "@/lib/commerce";
import { formatDateTime, formatMoney } from "@/lib/format";
import { manualOrderSchema, type ManualOrderInput } from "@/lib/validation";
import { orderTotalLabel, shippingPriceLabel } from "@/lib/shipping";
import { historicalOrders, officialOrders, operationStartLabel } from "@/lib/operation-scope";
import { canArchiveOrder, isOrderArchived, orderFinancialAdjustment, orderFinancialTotal } from "@/lib/order-finance";
import {
  lifecycleChangeConsequences,
  lifecycleReasonRequired,
  nextOrderAction,
  operationalOrderStatuses,
  orderOperationalStatus,
  orderPaymentStatuses,
  orderPaymentStatus,
} from "@/lib/order-lifecycle";
import type { Order, OrderOperationalStatus, OrderPaymentStatus } from "@/types/store";
import { useAdminDialog } from "./use-admin-dialog";
import { WhatsappAssistantDialog, WhatsappAssistantQueue, type WhatsappAssistantTarget } from "./whatsapp-assistant";
import { AdminSearchSelect, type AdminSearchOption } from "./admin-search-select";

const statuses = operationalOrderStatuses;
const paymentStatuses = orderPaymentStatuses;
const states = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

function emptyManualOrder(): ManualOrderInput {
  return {
    customerId: "",
    name: "",
    phone: "",
    email: "",
    deliveryMethod: "delivery",
    zip: "",
    city: "",
    state: "",
    address: "",
    number: "",
    complement: "",
    payment: "Pix",
    couponCode: "",
    internalNotes: "",
    items: [{ productId: "", quantity: 1 }],
  };
}

export function OrdersAdmin() {
  const { data, demoMode, referenceNow } = useAdminData();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Order | null>(null);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [status, setStatus] = useState(() => searchParams.get("status") ?? "all");
  const [paymentStatus, setPaymentStatus] = useState(() => searchParams.get("payment") ?? "all");
  const [scope, setScope] = useState<"official" | "history">("official");
  const [archiveView, setArchiveView] = useState<"active" | "archived">("active");
  const [page, setPage] = useState(1);
  const [assistantTarget, setAssistantTarget] = useState<WhatsappAssistantTarget | null>(null);
  useEffect(() => { const externalQuery = searchParams.get("q"); if (externalQuery !== null) { setQuery(externalQuery); setPage(1); } }, [searchParams]);
  const operationOrders = useMemo(() => officialOrders(data.orders, data.settings), [data.orders, data.settings]);
  const historyOrders = useMemo(() => historicalOrders(data.orders, data.settings), [data.orders, data.settings]);
  const operationDate = operationStartLabel(data.settings);
  const scopeOrders = useMemo(() => scope === "official" ? operationOrders : historyOrders, [historyOrders, operationOrders, scope]);
  const referenceDate = useMemo(() => new Date(referenceNow), [referenceNow]);
  const activeCount = scopeOrders.filter((order) => !isOrderArchived(order, referenceDate)).length;
  const archivedCount = scopeOrders.filter((order) => isOrderArchived(order, referenceDate)).length;
  const visibleScopeOrders = useMemo(() => scopeOrders.filter((order) => archiveView === "archived" ? isOrderArchived(order, referenceDate) : !isOrderArchived(order, referenceDate)), [archiveView, referenceDate, scopeOrders]);
  const statusCounts = useMemo(() => Object.fromEntries(statuses.map((item) => [item, visibleScopeOrders.filter((order) => orderOperationalStatus(order) === item).length])), [visibleScopeOrders]);
  const paymentCounts = useMemo(() => Object.fromEntries(paymentStatuses.map((item) => [item, visibleScopeOrders.filter((order) => orderPaymentStatus(order) === item).length])), [visibleScopeOrders]);
  const filtered = useMemo(() => scopeOrders.filter((order) => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const matches = !normalized || `${order.code} ${order.customer.name} ${order.customer.email} ${order.customer.phone}`.toLocaleLowerCase("pt-BR").includes(normalized);
    const matchesArchive = archiveView === "archived" ? isOrderArchived(order, referenceDate) : !isOrderArchived(order, referenceDate);
    const matchesStatus = status === "all" || orderOperationalStatus(order) === status;
    const matchesPayment = paymentStatus === "all" || orderPaymentStatus(order) === paymentStatus;
    return matches && matchesArchive && matchesStatus && matchesPayment;
  }), [archiveView, paymentStatus, query, referenceDate, scopeOrders, status]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);

  return (
    <>
      <AdminPanel
        title="Pedidos"
        description="Localize pedidos, acompanhe o status ou registre uma venda feita pelo atendimento."
        action={<button className="admin-button primary" aria-label="Criar pedido" onClick={() => setCreating(true)}><Plus /><span>Criar pedido</span></button>}
      >
        <div className="orders-view-switch" role="tablist" aria-label="Visualização de pedidos">
          <button type="button" role="tab" aria-selected={archiveView === "active"} className={archiveView === "active" ? "active" : ""} onClick={() => { setArchiveView("active"); setPage(1); }}><PackagePlus /> Ativos <span>{activeCount}</span></button>
          <button type="button" role="tab" aria-selected={archiveView === "archived"} className={archiveView === "archived" ? "active" : ""} onClick={() => { setArchiveView("archived"); setPage(1); }}><Archive /> Arquivados <span>{archivedCount}</span></button>
        </div>
        <div className="admin-order-status-strip" aria-label="Etapas dos pedidos">
          <button className={status === "all" && paymentStatus === "all" ? "active" : ""} onClick={() => { setStatus("all"); setPaymentStatus("all"); setPage(1); }}><span>Todos</span><strong>{archiveView === "archived" ? archivedCount : activeCount}</strong></button>
          <button className={status === "Novo" && paymentStatus === "all" ? "active" : ""} onClick={() => { setStatus("Novo"); setPaymentStatus("all"); setPage(1); }}><span>Novos</span><strong>{statusCounts.Novo ?? 0}</strong></button>
          <button className={status === "all" && paymentStatus === "Pendente" ? "active" : ""} onClick={() => { setStatus("all"); setPaymentStatus("Pendente"); setPage(1); }}><span>Aguardando pagamento</span><strong>{paymentCounts.Pendente ?? 0}</strong></button>
          <button className={status === "all" && paymentStatus === "Recebido" ? "active" : ""} onClick={() => { setStatus("all"); setPaymentStatus("Recebido"); setPage(1); }}><span>Pagos</span><strong>{paymentCounts.Recebido ?? 0}</strong></button>
          <button className={status === "Em preparação" && paymentStatus === "all" ? "active" : ""} onClick={() => { setStatus("Em preparação"); setPaymentStatus("all"); setPage(1); }}><span>Em preparação</span><strong>{statusCounts["Em preparação"] ?? 0}</strong></button>
          <button className={status === "Entregue" && paymentStatus === "all" ? "active" : ""} onClick={() => { setStatus("Entregue"); setPaymentStatus("all"); setPage(1); }}><span>Entregues</span><strong>{statusCounts.Entregue ?? 0}</strong></button>
          <button className={status === "Cancelado" && paymentStatus === "all" ? "active" : ""} onClick={() => { setStatus("Cancelado"); setPaymentStatus("all"); setPage(1); }}><span>Cancelados</span><strong>{statusCounts.Cancelado ?? 0}</strong></button>
        </div>
        <div className="admin-list-toolbar">
          <label className="admin-search-field"><Search /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar por pedido, cliente, e-mail ou telefone" aria-label="Buscar pedidos" /></label>
          {operationDate && <label><span>Período</span><select value={scope} onChange={(event) => { setScope(event.target.value as "official" | "history"); setPage(1); }}><option value="official">Desde {operationDate}</option><option value="history">Histórico anterior</option></select></label>}
          <label className="admin-order-status-select"><span>Situação do pedido</span><select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="all">Todas</option>{statuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <label className="admin-order-status-select"><span>Pagamento</span><select value={paymentStatus} onChange={(event) => { setPaymentStatus(event.target.value); setPage(1); }}><option value="all">Todos</option>{paymentStatuses.map((item) => <option value={item} key={item}>{item}</option>)}</select></label>
          <strong>{filtered.length} pedido{filtered.length === 1 ? "" : "s"}</strong>
        </div>
        {visible.length ? (
          <>
            <div className="admin-table-wrap admin-orders-desktop"><table className="admin-table admin-orders-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Pagamento</th><th>Financeiro</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{visible.map((order) => { const financialTotal = orderFinancialTotal(order); const adjusted = financialTotal !== order.total; const operational = orderOperationalStatus(order); const payment = orderPaymentStatus(order); return <tr key={order.id}><td><button className="admin-table-link" onClick={() => setSelected(order)}>{order.code}</button>{isOrderArchived(order, referenceDate) && <small className="table-secondary">Arquivado</small>}</td><td><button className="admin-customer-cell admin-table-link" onClick={() => setSelected(order)}><strong>{order.customer.name}</strong><small>{order.customer.email}</small></button></td><td>{formatDateTime(order.createdAt)}</td><td><div className="admin-payment-cell"><span className={payment === "Pendente" || payment === "Parcial" ? "pending" : payment === "Recebido" ? "received" : "cancelled"}>{payment}</span><small>{order.payment === "Cartao" ? "Cartão" : order.payment}</small></div></td><td><strong>{formatMoney(financialTotal)}</strong>{adjusted && <small className="table-secondary">Pedido: {formatMoney(order.total)}</small>}</td><td><StatusTag active={operational !== "Cancelado"}>{operational}</StatusTag></td><td><div className="admin-actions admin-row-actions"><button className="admin-button" onClick={() => setAssistantTarget({ order })}><MessageCircle /> WhatsApp</button><button className="admin-button" onClick={() => setSelected(order)}>Abrir <ChevronRight /></button></div></td></tr>; })}</tbody></table></div>
            <div className="admin-mobile-cards admin-orders-mobile-list">{visible.map((order) => {
              const itemCount = order.items.reduce((total, item) => total + item.quantity, 0);
              const paymentLabel = orderPaymentStatus(order);
              const operational = orderOperationalStatus(order);
              const financialTotal = orderFinancialTotal(order);
              return <article className="admin-order-mobile-card" key={order.id}>
                <header><button className="admin-table-link" onClick={() => setSelected(order)}>{order.code}</button><time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}{isOrderArchived(order, referenceDate) ? " · Arquivado" : ""}</time></header>
                <div className="admin-order-mobile-main"><strong>{order.customer.name}</strong><b>{formatMoney(financialTotal)}</b></div>
                {financialTotal !== order.total && <small className="table-secondary">Pedido: {formatMoney(order.total)}</small>}
                <button className="admin-order-mobile-items" type="button" onClick={() => setSelected(order)}>{itemCount} {itemCount === 1 ? "unidade" : "unidades"} <ChevronDown /></button>
                <footer>
                  <div className="admin-order-mobile-statuses"><span className={`admin-payment-pill ${paymentLabel === "Pendente" || paymentLabel === "Parcial" ? "pending" : paymentLabel === "Recebido" ? "received" : "cancelled"}`}>{paymentLabel}</span><StatusTag active={operational !== "Cancelado"}>{operational}</StatusTag></div>
                  <button className="admin-mobile-kebab" type="button" aria-label={`Abrir pedido ${order.code}`} onClick={() => setSelected(order)}><MoreVertical /></button>
                </footer>
              </article>;
            })}</div>
            <div className="admin-pagination"><span>Página {currentPage} de {pageCount}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior"><ChevronLeft /></button><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Próxima página"><ChevronRight /></button></div></div>
          </>
        ) : <AdminEmpty>{archiveView === "archived" ? <Archive /> : <PackagePlus />}<strong>{archiveView === "archived" ? "Nenhum pedido arquivado neste período." : scope === "history" ? "Nenhum pedido no histórico anterior." : "Nenhum pedido na operação oficial."}</strong><span>{archiveView === "archived" ? "Pedidos entregues ou cancelados podem ser arquivados pela tela de detalhes." : scope === "history" ? "Os pedidos antigos continuam disponíveis aqui quando existirem." : demoMode ? "Ajuste os filtros ou faça uma compra demonstrativa na loja." : "A partir do início oficial, os novos pedidos aparecerão aqui."}</span></AdminEmpty>}
      </AdminPanel>
      <WhatsappAssistantQueue onCompose={setAssistantTarget} />
      {creating && <ManualOrderDialog onClose={() => setCreating(false)} onCreated={(order) => { setCreating(false); setSelected(order); setPage(1); }} />}
      {selected && <OrderDetail order={data.orders.find((order) => order.id === selected.id) ?? selected} onClose={() => setSelected(null)} onWhatsApp={(order) => { setSelected(null); setAssistantTarget({ order }); }} />}
      {assistantTarget && <WhatsappAssistantDialog target={assistantTarget} onClose={() => setAssistantTarget(null)} />}
    </>
  );
}

function ManualOrderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (order: Order) => void }) {
  const { data, createOrder } = useAdminData();
  const [form, setForm] = useState<ManualOrderInput>(emptyManualOrder);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const panelRef = useAdminDialog(onClose);
  const availableProducts = useMemo(
    () => data.products.filter((product) => product.active && product.stock > 0).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [data.products],
  );
  const customerOptions = useMemo<AdminSearchOption[]>(
    () => data.customers.slice().sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((customer) => ({
      value: customer.id,
      label: customer.name,
      description: [customer.email, customer.phone, customer.city].filter(Boolean).join(" · "),
    })),
    [data.customers],
  );
  const selectedCoupon = useMemo(
    () => data.coupons.find((coupon) => coupon.code.toUpperCase() === form.couponCode.trim().toUpperCase()) ?? null,
    [data.coupons, form.couponCode],
  );
  const calculation = useMemo(
    () => calculateCart(form.items, data.products, data.settings, selectedCoupon, form.payment, data.cashbackCampaigns, { city: form.city, state: form.state, deliveryMethod: form.deliveryMethod }),
    [data.cashbackCampaigns, data.products, data.settings, form.city, form.deliveryMethod, form.items, form.payment, form.state, selectedCoupon],
  );

  function selectCustomer(customerId: string) {
    if (!customerId) {
      setForm((current) => ({ ...current, customerId: "", name: "", phone: "", email: "", city: "", state: "" }));
      return;
    }
    const customer = data.customers.find((item) => item.id === customerId);
    if (!customer) return;
    setForm((current) => ({
      ...current,
      customerId: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      city: customer.city,
      state: customer.state,
    }));
  }

  function updateItem(index: number, changes: Partial<ManualOrderInput["items"][number]>) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const parsed = manualOrderSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os dados do pedido.");
      return;
    }
    setSaving(true);
    try {
      const order = await createOrder(parsed.data);
      onCreated(order);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível criar o pedido.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-label="Criar pedido">
      <button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" />
      <div className="admin-modal-panel manual-order-panel" ref={panelRef}>
        <header>
          <div><span>NOVO PEDIDO</span><h2>Criar pedido manual</h2><small>O pedido será criado com o status Novo e reservará o estoque.</small></div>
          <button type="button" onClick={onClose} aria-label="Fechar"><X /></button>
        </header>
        <form className="manual-order-form" onSubmit={submit} noValidate>
          <section className="manual-order-section">
            <div className="manual-order-section-heading"><span>1</span><div><h3>Cliente</h3><p>Selecione alguém do CRM ou informe um novo cliente.</p></div></div>
            <div className="manual-order-fields">
              <div className="full"><AdminSearchSelect label="Buscar cliente no CRM" value={form.customerId} options={customerOptions} placeholder="Digite nome, e-mail ou WhatsApp" emptyMessage="Cliente não encontrado. Cadastre pelos campos abaixo." onChange={(customerId) => customerId ? selectCustomer(customerId) : setForm((current) => ({ ...current, customerId: "" }))} /></div>
              <label>Nome completo<input aria-label="Nome completo do cliente" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
              <label>WhatsApp<input aria-label="WhatsApp do cliente" inputMode="tel" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(31) 99999-9999" /></label>
              <label className="full">E-mail<input aria-label="E-mail do cliente" type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
            </div>
          </section>

          <section className="manual-order-section">
            <div className="manual-order-section-heading"><span>2</span><div><h3>Produtos</h3><p>Use apenas produtos ativos e com estoque disponível.</p></div><button type="button" className="admin-button" onClick={() => setForm((current) => ({ ...current, items: [...current.items, { productId: "", quantity: 1 }] }))}><Plus /> Adicionar item</button></div>
            <div className="manual-order-lines">
              {form.items.map((item, index) => {
                const product = data.products.find((candidate) => candidate.id === item.productId);
                const selectedElsewhere = new Set(form.items.filter((_, itemIndex) => itemIndex !== index).map((candidate) => candidate.productId));
                const productOptions: AdminSearchOption[] = availableProducts.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                  description: `${candidate.sku} · estoque ${candidate.stock} · ${formatMoney(candidate.price)}`,
                  disabled: selectedElsewhere.has(candidate.id),
                }));
                return (
                  <div className="manual-order-line" key={index}>
                    <AdminSearchSelect label={`Produto ${index + 1}`} value={item.productId} options={productOptions} placeholder="Busque por produto ou SKU" onChange={(productId) => updateItem(index, { productId, quantity: 1 })} />
                    <label>Quantidade<input aria-label={`Quantidade do produto ${index + 1}`} type="number" min={1} max={product?.stock ?? 100} value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></label>
                    <div className="manual-order-line-total"><span>Subtotal</span><strong>{formatMoney((product?.price ?? 0) * item.quantity)}</strong><small>{product ? `${formatMoney(product.price)} cada${product.cashback > 0 ? ` · +${formatMoney(product.cashback * item.quantity)} cashback` : ""}` : "Selecione o produto"}</small></div>
                    <button type="button" className="admin-icon-button" disabled={form.items.length === 1} onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))} aria-label={`Remover produto ${index + 1}`}><Trash2 /></button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="manual-order-section">
            <div className="manual-order-section-heading"><span>3</span><div><h3>Condições e entrega</h3><p>O cupom, o desconto no Pix e o frete são calculados automaticamente.</p></div></div>
            <div className="manual-order-fields">
              <label>Pagamento<select aria-label="Forma de pagamento" value={form.payment} onChange={(event) => setForm((current) => ({ ...current, payment: event.target.value as ManualOrderInput["payment"] }))}><option value="Pix">Pix</option><option value="Cartao">Cartão · 2x sem juros</option><option value="Dinheiro">Dinheiro</option></select></label>
              <label>Cupom<input aria-label="Cupom" value={form.couponCode} onChange={(event) => setForm((current) => ({ ...current, couponCode: event.target.value.toUpperCase() }))} placeholder="Opcional" /></label>
              <label className="full">Forma de recebimento<select aria-label="Forma de recebimento" value={form.deliveryMethod} onChange={(event) => setForm((current) => ({ ...current, deliveryMethod: event.target.value as ManualOrderInput["deliveryMethod"] }))}><option value="delivery">Entrega no endereço</option>{data.settings.localPickupEnabled && <option value="pickup">Retirada no local · sem frete</option>}</select></label>
              {form.deliveryMethod === "delivery" ? <><label>CEP<input aria-label="CEP" inputMode="numeric" value={form.zip} onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))} placeholder="00000-000" /></label>
              <label>Cidade<input aria-label="Cidade" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} /></label>
              <label>Estado<select aria-label="Estado" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}><option value="">Selecione</option>{states.map((state) => <option key={state}>{state}</option>)}</select></label>
              <label>Endereço<input aria-label="Endereço" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} /></label>
              <label>Número<input aria-label="Número" value={form.number} onChange={(event) => setForm((current) => ({ ...current, number: event.target.value }))} /></label>
              <label>Complemento<input aria-label="Complemento" value={form.complement} onChange={(event) => setForm((current) => ({ ...current, complement: event.target.value }))} /></label></> : <div className="admin-form-section full"><Truck /><div><strong>Retirada sem frete</strong><span>{data.settings.localPickupInstructions}</span></div></div>}
              <label className="full">Observações internas<textarea aria-label="Observações internas do novo pedido" rows={3} value={form.internalNotes} onChange={(event) => setForm((current) => ({ ...current, internalNotes: event.target.value }))} placeholder="Ex.: pedido recebido pelo WhatsApp, retirada combinada..." /></label>
            </div>
          </section>

          <aside className="manual-order-summary" aria-label="Resumo do novo pedido">
            <div><span>Subtotal</span><strong>{formatMoney(calculation.subtotal)}</strong></div>
            <div><span>Descontos</span><strong>- {formatMoney(calculation.discount)}</strong></div>
            <div><span>Frete</span><strong>{shippingPriceLabel(calculation.shippingStatus, calculation.shipping)}</strong></div>
            {calculation.cashback > 0 && <div className="cashback"><span>Cashback previsto</span><strong>+ {formatMoney(calculation.cashback)}</strong></div>}
            <div className="total"><span>{orderTotalLabel(calculation.shippingStatus)}</span><strong>{formatMoney(calculation.total)}</strong></div>
            <p><PackagePlus /> {calculation.items} item{calculation.items === 1 ? "" : "s"} será{calculation.items === 1 ? "" : "ão"} reservado{calculation.items === 1 ? "" : "s"} no estoque.</p>
          </aside>

          {error && <p className="admin-form-error manual-order-error" role="alert">{error}</p>}
          <footer className="manual-order-actions"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" disabled={saving || !availableProducts.length}><PackagePlus /> {saving ? "Criando pedido..." : "Criar pedido e reservar estoque"}</button></footer>
        </form>
      </div>
    </div>
  );
}

function OrderDetail({ order, onClose, onWhatsApp }: { order: Order; onClose: () => void; onWhatsApp: (order: Order) => void }) {
  const {
    data,
    currentUser,
    referenceNow,
    updateOrderLifecycle,
    saveOrderDetails,
    adjustOrderFinancialTotal,
    setOrderArchived,
  } = useAdminData();
  const currentOperationalStatus = orderOperationalStatus(order);
  const currentPaymentStatus = orderPaymentStatus(order);
  const [operationalStatus, setOperationalStatus] = useState<OrderOperationalStatus>(currentOperationalStatus);
  const [paymentStatus, setPaymentStatus] = useState<OrderPaymentStatus>(currentPaymentStatus);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [reviewingLifecycle, setReviewingLifecycle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingFinancial, setSavingFinancial] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [internalNotes, setInternalNotes] = useState(order.internalNotes);
  const [trackingCode, setTrackingCode] = useState(order.trackingCode);
  const [financialTotal, setFinancialTotal] = useState(String(orderFinancialTotal(order).toFixed(2)));
  const [financialReason, setFinancialReason] = useState("");
  const [error, setError] = useState("");
  const panelRef = useAdminDialog(onClose);
  const archived = isOrderArchived(order, new Date(referenceNow));
  const currentFinancialTotal = orderFinancialTotal(order);
  const adjustment = orderFinancialAdjustment(order);
  const typedFinancialTotal = Number(financialTotal.replace(",", "."));
  const financialChanged = Number.isFinite(typedFinancialTotal) && Math.abs(typedFinancialTotal - currentFinancialTotal) >= 0.01;
  const canManageFinance = currentUser.role === "owner" || currentUser.permissions.includes("finance");
  const lifecycleChanged = operationalStatus !== currentOperationalStatus || paymentStatus !== currentPaymentStatus;
  const reasonRequired = lifecycleReasonRequired(order, operationalStatus, paymentStatus);
  const consequences = lifecycleChangeConsequences(order, operationalStatus, paymentStatus);
  const nextAction = archived ? null : nextOrderAction(order);
  const terminalOrder = currentOperationalStatus === "Cancelado";
  const allowedPaymentStatuses = operationalStatus === "Cancelado"
    ? ([currentPaymentStatus === "Recebido" || currentPaymentStatus === "Parcial" ? "Estornado" : "Cancelado"] as OrderPaymentStatus[])
    : (["Pendente", "Parcial", "Recebido"] as OrderPaymentStatus[]);

  function selectOperationalStatus(value: OrderOperationalStatus) {
    setOperationalStatus(value);
    setReviewingLifecycle(false);
    if (value === "Cancelado") {
      setPaymentStatus(currentPaymentStatus === "Recebido" || currentPaymentStatus === "Parcial" ? "Estornado" : "Cancelado");
    } else if (paymentStatus === "Estornado" || paymentStatus === "Cancelado") {
      setPaymentStatus("Pendente");
    }
  }

  async function saveLifecycle() {
    if (!lifecycleChanged || (reasonRequired && lifecycleReason.trim().length < 5)) return;
    setSaving(true);
    setError("");
    try {
      await updateOrderLifecycle(order.id, { operationalStatus, paymentStatus, reason: lifecycleReason.trim() });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o pedido.");
      setReviewingLifecycle(false);
    } finally {
      setSaving(false);
    }
  }

  async function saveFinancialAdjustment() {
    setSavingFinancial(true);
    setError("");
    try {
      await adjustOrderFinancialTotal(order.id, { total: typedFinancialTotal, reason: financialReason });
      setFinancialReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível ajustar o valor financeiro.");
    } finally {
      setSavingFinancial(false);
    }
  }

  async function toggleArchive() {
    setArchiving(true);
    setError("");
    try {
      await setOrderArchived(order.id, !archived);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível atualizar o arquivo.");
    } finally {
      setArchiving(false);
    }
  }

  async function runNextAction() {
    if (!nextAction) return;
    if (nextAction.archive) {
      await toggleArchive();
      return;
    }
    setOperationalStatus(nextAction.operationalStatus ?? currentOperationalStatus);
    setPaymentStatus(nextAction.paymentStatus ?? currentPaymentStatus);
    setLifecycleReason("");
    setReviewingLifecycle(true);
  }

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-label={`Pedido ${order.code}`}>
      <button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" />
      <div className="admin-modal-panel order-detail-panel" ref={panelRef}>
        <header>
          <div><span>{archived ? "PEDIDO ARQUIVADO" : "PEDIDO"}</span><h2>{order.code}</h2><small>{formatDateTime(order.createdAt)}</small></div>
          <button type="button" data-dialog-initial-focus onClick={onClose} aria-label="Fechar"><X /></button>
        </header>

        {archived && <div className="order-archived-notice"><Archive /><div><strong>Fora da fila operacional</strong><span>O pedido continua nos relatórios e pode ser restaurado a qualquer momento.</span></div></div>}
        {!archived && order.archiveAfter && <div className="order-archived-notice scheduled"><Archive /><div><strong>Arquivamento programado</strong><span>Este pedido sairá automaticamente da fila ativa em {formatDateTime(order.archiveAfter)}.</span></div></div>}

        <div className="order-details">
          <section>
            <h3>Cliente</h3>
            <p><strong>{order.customer.name}</strong></p><p>{order.customer.email}</p><p>{order.customer.phone}</p>
            {order.shippingStatus === "pickup" || order.customer.deliveryMethod === "pickup" ? <><p><strong>Retirada no local</strong></p><p>{data.settings.localPickupInstructions}</p></> : <><p>{order.customer.address}, {order.customer.number}</p><p>{order.customer.city}/{order.customer.state} · CEP {order.customer.zip}</p></>}
            <div className="order-customer-actions"><button className="admin-button primary" onClick={() => onWhatsApp(order)}><MessageCircle /> Preparar WhatsApp</button><Link className="admin-button" href="/admin/customers"><UserRound /> Abrir no CRM</Link></div>
          </section>
          <section>
            <h3>Resumo comercial</h3>
            {order.items.map((item) => <div className="order-item" key={`${item.productId}-${item.name}`}><span>{item.quantity}x {item.name}{item.unitCashback > 0 ? ` · +${formatMoney(item.unitCashback * item.quantity)} cashback` : ""}</span><strong>{formatMoney(item.unitPrice * item.quantity)}</strong></div>)}
            <div className="order-item"><span>Desconto</span><strong>- {formatMoney(order.discount)}</strong></div>
            <div className="order-item"><span>Frete</span><strong>{shippingPriceLabel(order.shippingStatus, order.shipping)}</strong></div>
            <div className="order-item total"><span>{orderTotalLabel(order.shippingStatus)}</span><strong>{formatMoney(order.total)}</strong></div>
            {order.cashbackTotal > 0 && <div className="order-item cashback"><span>Cashback prometido</span><strong>+ {formatMoney(order.cashbackTotal)}</strong></div>}
          </section>
        </div>

        <section className="order-financial-card">
          <div className="order-financial-heading"><CircleDollarSign /><div><h3>Controle financeiro</h3><p>Corrija o valor reconhecido no caixa sem mudar o pedido, o cashback ou o estoque.</p></div></div>
          <div className="order-financial-summary">
            <div><span>Total do cliente</span><strong>{formatMoney(order.total)}</strong></div>
            <div><span>Valor financeiro</span><strong>{formatMoney(currentFinancialTotal)}</strong></div>
            <div className={adjustment === 0 ? "neutral" : adjustment > 0 ? "positive" : "negative"}><span>Diferença</span><strong>{adjustment > 0 ? "+ " : ""}{formatMoney(adjustment)}</strong></div>
          </div>
          {order.financialAdjustmentReason && <div className="order-financial-history"><strong>Último ajuste</strong><span>{order.financialAdjustmentReason}</span><small>{order.financialAdjustedAt ? formatDateTime(order.financialAdjustedAt) : ""}{order.financialAdjustedBy ? ` · ${order.financialAdjustedBy}` : ""}</small></div>}
          <div className="order-financial-form">
            <label>Valor financeiro confirmado<input aria-label="Valor financeiro confirmado" inputMode="decimal" value={financialTotal} disabled={!canManageFinance || currentOperationalStatus === "Cancelado"} onChange={(event) => setFinancialTotal(event.target.value)} /></label>
            <label>Motivo da alteração<input aria-label="Motivo da alteração financeira" maxLength={300} value={financialReason} disabled={!canManageFinance || currentOperationalStatus === "Cancelado"} onChange={(event) => setFinancialReason(event.target.value)} placeholder="Ex.: valor renegociado no atendimento" /></label>
            <button className="admin-button primary" disabled={!canManageFinance || currentOperationalStatus === "Cancelado" || savingFinancial || !financialChanged || financialReason.trim().length < 5} onClick={() => void saveFinancialAdjustment()}><Save /> {savingFinancial ? "Salvando..." : "Registrar ajuste"}</button>
          </div>
          {!canManageFinance && <small className="order-financial-help">Seu usuário precisa da permissão Financeiro para fazer este ajuste.</small>}
          {currentOperationalStatus === "Cancelado" && <small className="order-financial-help">Pedidos cancelados não entram na receita.</small>}
        </section>

        <div className="order-management-fields">
          <label>Código de rastreamento<input value={trackingCode} onChange={(event) => setTrackingCode(event.target.value)} placeholder="Opcional" /></label>
          <label>Observações internas<textarea rows={3} value={internalNotes} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Informações visíveis apenas para a equipe" /></label>
          <button className="admin-button" disabled={savingDetails || (trackingCode === order.trackingCode && internalNotes === order.internalNotes)} onClick={async () => { setSavingDetails(true); try { await saveOrderDetails(order.id, { trackingCode, internalNotes }); } finally { setSavingDetails(false); } }}><Save /> {savingDetails ? "Salvando..." : "Salvar detalhes"}</button>
        </div>

        {error && <p className="admin-form-error order-update-error" role="alert">{error}</p>}

        {!archived && nextAction && <section className="order-next-action-card">
          <div><span>PRÓXIMO PASSO</span><strong>{nextAction.label}</strong><p>{nextAction.description}</p></div>
          <button className="admin-button primary" disabled={saving || (nextAction.paymentStatus === "Recebido" && !canManageFinance)} onClick={() => void runNextAction()}>{nextAction.label} <ChevronRight /></button>
        </section>}

        <section className="order-lifecycle-card">
          <div className="order-lifecycle-heading"><div><span>CONTROLE DO PEDIDO</span><h3>Andamento e pagamento</h3><p>O pedido pode avançar sem que o dinheiro tenha entrado. Por isso, os dois controles ficam separados.</p></div></div>
          <div className="order-status-editor order-lifecycle-editor">
            <label>Situação do pedido<select aria-label="Situação do pedido" value={operationalStatus} disabled={archived || terminalOrder} onChange={(event) => selectOperationalStatus(event.target.value as OrderOperationalStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Situação do pagamento<select aria-label="Situação do pagamento" value={paymentStatus} disabled={archived || terminalOrder || !canManageFinance} onChange={(event) => { setPaymentStatus(event.target.value as OrderPaymentStatus); setReviewingLifecycle(false); }}>{allowedPaymentStatuses.map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="admin-button primary" disabled={archived || terminalOrder || saving || !lifecycleChanged || (paymentStatus !== currentPaymentStatus && !canManageFinance)} onClick={() => setReviewingLifecycle(true)}>Revisar alteração</button>
          </div>
          {!canManageFinance && <small className="order-financial-help">Seu usuário pode atualizar o andamento, mas precisa da permissão Financeiro para alterar o pagamento.</small>}
          {terminalOrder && <small className="order-financial-help">Pedidos cancelados ficam preservados para auditoria e não podem voltar à operação.</small>}
          {reviewingLifecycle && lifecycleChanged && <div className="order-lifecycle-confirmation" role="region" aria-label="Confirmar alteração do pedido">
            <div><span>CONFIRME ANTES DE SALVAR</span><h3>O que vai acontecer</h3></div>
            <ul>{consequences.map((consequence) => <li key={consequence}>{consequence}</li>)}</ul>
            {reasonRequired && <label>Motivo obrigatório<textarea aria-label="Motivo da alteração do pedido" rows={3} maxLength={300} value={lifecycleReason} onChange={(event) => setLifecycleReason(event.target.value)} placeholder="Explique o motivo para deixar registrado" /></label>}
            <div className="order-lifecycle-confirmation-actions"><button className="admin-button" type="button" onClick={() => setReviewingLifecycle(false)}>Voltar</button><button className="admin-button primary" type="button" disabled={saving || (reasonRequired && lifecycleReason.trim().length < 5)} onClick={() => void saveLifecycle()}>{saving ? "Salvando..." : "Confirmar alteração"}</button></div>
          </div>}
        </section>

        <div className="order-record-actions">
          <div><strong>{archived ? "Restaurar pedido" : "Arquivar pedido"}</strong><span>{archived ? "O pedido voltará para a lista ativa." : canArchiveOrder(order) ? "Remove da fila sem apagar histórico, estoque ou financeiro." : "Disponível somente após entregar ou cancelar."}</span></div>
          <button className="admin-button" disabled={archiving || (!archived && !canArchiveOrder(order))} onClick={() => void toggleArchive()}>{archived ? <ArchiveRestore /> : <Archive />} {archiving ? "Salvando..." : archived ? "Restaurar" : "Arquivar"}</button>
        </div>
      </div>
    </div>
  );
}
