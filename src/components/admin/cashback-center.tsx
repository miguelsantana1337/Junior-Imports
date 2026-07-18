"use client";

import { BadgeDollarSign, CalendarDays, CirclePause, CirclePlay, Clock3, Coins, Pencil, Plus, Sparkles, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { activeCashbackCampaigns, campaignAudienceLabel, cashbackWalletSummary } from "@/lib/cashback";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cashbackCampaignSchema } from "@/lib/validation";
import type { CashbackCampaign, CustomerSegment } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel } from "./admin-ui";

const segmentLabels: Record<CustomerSegment, string> = { new: "Novos", active: "Ativos", recurring: "Recorrentes", vip: "VIP", at_risk: "Em risco", inactive: "Inativos" };
const statusLabels: Record<CashbackCampaign["status"], string> = { draft: "Rascunho", active: "Ativa", paused: "Pausada", ended: "Encerrada" };

function localDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

function newCampaign(): CashbackCampaign {
  const start = new Date();
  const end = new Date(start.getTime() + 30 * 86_400_000);
  return { id: crypto.randomUUID(), name: "", description: "", status: "draft", startsAt: start.toISOString(), endsAt: end.toISOString(), multiplier: 2, fixedBonus: 0, creditValidDays: 90, priority: 100, targetSegments: [], productIds: [], createdAt: start.toISOString(), updatedAt: start.toISOString() };
}

export function CashbackCenter() {
  const { data, saveCashbackCampaign } = useAdminData();
  const [editing, setEditing] = useState<CashbackCampaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const summary = useMemo(() => cashbackWalletSummary(data.cashbackEntries), [data.cashbackEntries]);
  const active = useMemo(() => activeCashbackCampaigns(data.cashbackCampaigns), [data.cashbackCampaigns]);
  const customersWithBalance = useMemo(() => data.customers.filter((customer) => cashbackWalletSummary(data.cashbackEntries, customer.id).available > 0).length, [data.cashbackEntries, data.customers]);
  const availableBalance = useMemo(() => data.customers.reduce((sum, customer) => sum + cashbackWalletSummary(data.cashbackEntries, customer.id).available, 0), [data.cashbackEntries, data.customers]);
  const eligibleProducts = data.products.filter((product) => product.active && product.cashback > 0);

  function toggleSegment(segment: CustomerSegment) {
    setEditing((current) => current ? { ...current, targetSegments: current.targetSegments.includes(segment) ? current.targetSegments.filter((item) => item !== segment) : [...current.targetSegments, segment] } : current);
  }

  function toggleProduct(id: string) {
    setEditing((current) => current ? { ...current, productIds: current.productIds.includes(id) ? current.productIds.filter((item) => item !== id) : [...current.productIds, id] } : current);
  }

  async function submit() {
    if (!editing) return;
    const parsed = cashbackCampaignSchema.safeParse(editing);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise a campanha.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await saveCashbackCampaign(parsed.data);
      setEditing(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível salvar a campanha.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <section className="cashback-summary-grid" aria-label="Resumo do cashback">
      <article className="primary"><WalletCards /><div><span>Saldo disponível</span><strong>{formatMoney(availableBalance)}</strong><small>{customersWithBalance} {customersWithBalance === 1 ? "cliente" : "clientes"} com saldo</small></div></article>
      <article><Coins /><div><span>Créditos gerados</span><strong>{formatMoney(summary.credited)}</strong><small>histórico imutável</small></div></article>
      <article><Clock3 /><div><span>Vence em 30 dias</span><strong>{formatMoney(summary.expiringSoon)}</strong><small>oportunidade de recompra</small></div></article>
      <article><Sparkles /><div><span>Campanhas ativas</span><strong>{active.length}</strong><small>{data.cashbackCampaigns.length} {data.cashbackCampaigns.length === 1 ? "configurada" : "configuradas"}</small></div></article>
    </section>

    <AdminPanel title="Campanhas de cashback" description="Combine período, produtos e segmentos. A campanha de maior prioridade é aplicada quando a venda for confirmada.">
      <div className="cashback-campaign-toolbar"><div><strong>Motor promocional</strong><span>O cashback base do produto é preservado; a campanha adiciona um bônus separado no extrato.</span></div><button className="admin-button primary" onClick={() => { setEditing(newCampaign()); setError(""); }}><Plus /> Nova campanha</button></div>
      <div className="cashback-campaign-list">
        {data.cashbackCampaigns.map((campaign) => <article key={campaign.id} className={campaign.status}>
          <header><div className="cashback-campaign-icon"><BadgeDollarSign /></div><div><span className={`cashback-campaign-status ${campaign.status}`}>{statusLabels[campaign.status]}</span><h3>{campaign.name}</h3><p>{campaign.description || "Sem descrição interna."}</p></div></header>
          <div className="cashback-campaign-rules"><span><Sparkles /> {campaign.multiplier.toFixed(2).replace(".00", "")}x{campaign.fixedBonus > 0 ? ` + ${formatMoney(campaign.fixedBonus)}` : ""}</span><span><CalendarDays /> {formatDateTime(campaign.startsAt)}{campaign.endsAt ? ` — ${formatDateTime(campaign.endsAt)}` : ""}</span><span><Clock3 /> Créditos por {campaign.creditValidDays} dias</span></div>
          <footer><div><strong>{campaignAudienceLabel(campaign.targetSegments)}</strong><span>{campaign.productIds.length ? `${campaign.productIds.length} produto${campaign.productIds.length === 1 ? "" : "s"}` : "Todos os produtos com cashback"} · prioridade {campaign.priority}</span></div><div><button className="admin-button" aria-label={`Editar ${campaign.name}`} onClick={() => { setEditing(campaign); setError(""); }}><Pencil /> Editar</button>{["active", "paused"].includes(campaign.status) && <button className="admin-button" onClick={() => { void saveCashbackCampaign({ ...campaign, status: campaign.status === "active" ? "paused" : "active" }).catch(() => undefined); }}>{campaign.status === "active" ? <CirclePause /> : <CirclePlay />} {campaign.status === "active" ? "Pausar" : "Ativar"}</button>}</div></footer>
        </article>)}
        {!data.cashbackCampaigns.length && <AdminEmpty><Sparkles /><strong>Nenhuma campanha configurada.</strong><span>Crie a primeira regra para acelerar recompra e retenção.</span></AdminEmpty>}
      </div>
    </AdminPanel>

    {editing && createPortal(<div className="cashback-campaign-editor" role="dialog" aria-modal="true" aria-label="Editar campanha de cashback"><button className="admin-modal-overlay" aria-label="Fechar" onClick={() => setEditing(null)} /><form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <header><div><span>REGRAS DE CASHBACK</span><h2>{data.cashbackCampaigns.some((item) => item.id === editing.id) ? "Editar campanha" : "Nova campanha"}</h2><p>Somente a campanha elegível com maior prioridade é aplicada a cada pedido.</p></div><button type="button" onClick={() => setEditing(null)} aria-label="Fechar">×</button></header>
      <div className="cashback-editor-grid">
        <label className="full">Nome<input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} placeholder="Ex.: Cashback em dobro para VIP" autoFocus /></label>
        <label className="full">Descrição interna<textarea rows={2} value={editing.description} onChange={(event) => setEditing({ ...editing, description: event.target.value })} placeholder="Objetivo e observações da campanha" /></label>
        <label>Status<select value={editing.status} onChange={(event) => setEditing({ ...editing, status: event.target.value as CashbackCampaign["status"] })}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Prioridade<input type="number" min="0" max="1000" value={editing.priority} onChange={(event) => setEditing({ ...editing, priority: Number(event.target.value) })} /></label>
        <label>Início<input type="datetime-local" value={localDateTime(editing.startsAt)} onChange={(event) => setEditing({ ...editing, startsAt: isoDateTime(event.target.value) })} /></label>
        <label>Término<input type="datetime-local" value={localDateTime(editing.endsAt)} onChange={(event) => setEditing({ ...editing, endsAt: isoDateTime(event.target.value) })} /></label>
        <label>Multiplicador<input type="number" min="1" max="10" step="0.1" value={editing.multiplier} onChange={(event) => setEditing({ ...editing, multiplier: Number(event.target.value) })} /><small>2x dobra o cashback configurado nos produtos.</small></label>
        <label>Bônus fixo por pedido<input type="number" min="0" step="0.01" value={editing.fixedBonus} onChange={(event) => setEditing({ ...editing, fixedBonus: Number(event.target.value) })} /></label>
        <label>Validade do crédito<input type="number" min="1" max="730" value={editing.creditValidDays} onChange={(event) => setEditing({ ...editing, creditValidDays: Number(event.target.value) })} /><small>Quantidade de dias após a confirmação.</small></label>
        <fieldset className="full"><legend>Segmentos elegíveis</legend><p>Sem seleção, a campanha vale para todos os clientes.</p><div className="cashback-choice-grid">{Object.entries(segmentLabels).map(([value, label]) => <label key={value}><input type="checkbox" checked={editing.targetSegments.includes(value as CustomerSegment)} onChange={() => toggleSegment(value as CustomerSegment)} /><span>{label}</span></label>)}</div></fieldset>
        <fieldset className="full"><legend>Produtos participantes</legend><p>Sem seleção, o multiplicador vale para todos os produtos que já possuem cashback.</p><div className="cashback-product-picker">{eligibleProducts.map((product) => <label key={product.id}><input type="checkbox" checked={editing.productIds.includes(product.id)} onChange={() => toggleProduct(product.id)} /><span><strong>{product.name}</strong><small>{formatMoney(product.cashback)} por unidade</small></span></label>)}</div></fieldset>
      </div>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <footer><button type="button" className="admin-button" onClick={() => setEditing(null)}>Cancelar</button><button className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar campanha"}</button></footer>
    </form></div>, document.body)}
  </>;
}
