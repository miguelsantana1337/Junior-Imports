"use client";

import {
  Activity, AlertTriangle, Barcode, Boxes, CheckCircle2, ChevronRight, CircleDollarSign, Copy,
  ExternalLink, Flag, Gift, HeartPulse, Loader2, Megaphone, MessageCircle, Mic,
  PackageCheck, RefreshCw, RotateCcw, Save, ShieldCheck, Sparkles, UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { parseMobileOperationDraft } from "@/lib/admin31";
import { formatDateTime, formatMoney, whatsappUrl } from "@/lib/format";
import { AdminEmpty, AdminPanel, StatusTag } from "@/components/admin/admin-ui";
import { adminReferralHref, hasSeparateCatalogs, type AdminCatalogDestination } from "@/lib/admin-catalog-link";
import { useAdminData } from "./admin-data-provider";

type Row = Record<string, unknown>;
type ModuleKey = "divergences" | "guardian" | "continuity" | "referrals" | "bundles" | "funnel" | "flags" | "mobile";
type ModulePayload = Record<string, unknown>;

const moduleInfo: Array<{ key: ModuleKey; label: string; description: string; icon: typeof Activity }> = [
  { key: "divergences", label: "Consistência", description: "Pedido, estoque, caixa e cashback", icon: ShieldCheck },
  { key: "guardian", label: "Campanhas", description: "Simule a margem antes de publicar", icon: CircleDollarSign },
  { key: "continuity", label: "Continuidade", description: "Alertas, backup e recuperação", icon: HeartPulse },
  { key: "referrals", label: "Indicações", description: "Códigos e recompensa por compra", icon: UsersRound },
  { key: "bundles", label: "Kits", description: "Monte produtos com componentes", icon: Boxes },
  { key: "funnel", label: "Funil", description: "Conversão e recuperação humana", icon: Activity },
  { key: "flags", label: "Publicação", description: "Ative ou interrompa recursos", icon: Flag },
  { key: "mobile", label: "Operação móvel", description: "Código, voz e reversão segura", icon: Barcode },
];

const stageLabels: Record<string, string> = {
  product_viewed: "Viu produto", added_to_cart: "Adicionou", checkout_started: "Iniciou checkout",
  order_registered: "Criou pedido", whatsapp_opened: "Abriu WhatsApp", partial_payment: "Pagou parte",
  paid: "Quitou", delivered: "Recebeu",
};

const text = (input: unknown) => String(input ?? "");
const number = (input: unknown) => Number(input) || 0;
const rows = (payload: ModulePayload | null, key: string) => Array.isArray(payload?.[key]) ? payload[key] as Row[] : [];

async function apiPost(action: string, input: Record<string, unknown> = {}) {
  const response = await fetch("/api/admin/admin31", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...input }),
  });
  const payload = await response.json().catch(() => null) as Row | null;
  if (!response.ok) throw new Error(text(payload?.error) || "Não foi possível concluir a operação.");
  return payload ?? {};
}

export function Admin31Operations({ initialModule = "divergences" }: { initialModule?: ModuleKey }) {
  const [active, setActive] = useState<ModuleKey>(initialModule);
  const [payload, setPayload] = useState<ModulePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/admin/admin31?module=${active}`, { cache: "no-store" });
      const next = await response.json().catch(() => null) as ModulePayload | null;
      if (!response.ok) throw new Error(text(next?.error) || "Não foi possível carregar este módulo.");
      setPayload(next ?? {});
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível carregar este módulo.");
    } finally { setLoading(false); }
  }, [active]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function run(id: string, task: () => Promise<unknown>, success: string, refreshAfter = true) {
    setBusy(id); setError(""); setMessage("");
    try { await task(); setMessage(success); if (refreshAfter) await refresh(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível concluir a operação."); }
    finally { setBusy(""); }
  }

  const current = moduleInfo.find((item) => item.key === active) ?? moduleInfo[0];
  return (
    <div className="admin31-workbench">
      <section className="admin31-hero">
        <div><span>ADMIN 3.1</span><h2>Central operacional</h2><p>O que exige atenção, decisão ou acompanhamento em uma única rotina.</p></div>
        <button className="admin-button" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} /> Atualizar</button>
      </section>

      <nav className="admin31-module-nav" aria-label="Módulos operacionais">
        {moduleInfo.map((item) => <button key={item.key} type="button" className={active === item.key ? "active" : ""} onClick={() => { setActive(item.key); setMessage(""); setError(""); }}>
          <item.icon /><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight />
        </button>)}
      </nav>

      <div className="admin31-current-heading"><current.icon /><div><small>{current.label.toUpperCase()}</small><strong>{current.description}</strong></div></div>
      {message && <div className="admin31-feedback success" role="status"><CheckCircle2 /> {message}</div>}
      {error && <div className="admin31-feedback error" role="alert"><AlertTriangle /> {error}</div>}
      {loading ? <div className="admin31-loading"><Loader2 className="spin" /><strong>Carregando visão atual...</strong></div> : <>
        {active === "divergences" && <Divergences payload={payload} busy={busy} run={run} />}
        {active === "guardian" && <Guardian payload={payload} busy={busy} run={run} />}
        {active === "continuity" && <Continuity payload={payload} busy={busy} run={run} />}
        {active === "referrals" && <Referrals payload={payload} busy={busy} run={run} />}
        {active === "bundles" && <Bundles payload={payload} busy={busy} run={run} />}
        {active === "funnel" && <Funnel payload={payload} busy={busy} run={run} />}
        {active === "flags" && <Flags payload={payload} busy={busy} run={run} />}
        {active === "mobile" && <MobileOperations payload={payload} busy={busy} run={run} />}
      </>}
    </div>
  );
}

type ModuleProps = { payload: ModulePayload | null; busy: string; run: (id: string, task: () => Promise<unknown>, success: string, refreshAfter?: boolean) => Promise<void> };

function Divergences({ payload, busy, run }: ModuleProps) {
  const confirm = useConfirm();
  const [reason, setReason] = useState("Conferido com os registros operacionais.");
  const divergences = rows(payload, "divergences");
  const open = divergences.filter((item) => !["resolved", "ignored"].includes(text(item.status)));

  async function reconcile(item: Row) {
    const preview = await apiPost("divergence_preview", { id: item.id });
    if (preview.manual) throw new Error(text((preview.preview as Row)?.guidance) || "Esta situação exige revisão manual.");
    const confirmation = preview.confirmation as Row;
    const accepted = await confirm({
      title: "Aplicar correção compensatória?",
      description: `${text(item.summary)} A operação será registrada na auditoria e não apagará o histórico. Motivo: ${reason}`,
      confirmLabel: "Aplicar correção",
      danger: text(item.severity) === "critical",
    });
    if (!accepted) return;
    await apiPost("divergence_apply", { id: item.id, confirmationId: confirmation.id, reason });
  }

  return <AdminPanel title="Fila de divergências" description="A varredura encontra diferenças; somente regras determinísticas podem ser corrigidas automaticamente.">
    <div className="admin31-inline-field"><label>Motivo obrigatório para correções<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} /></label><span>{open.length} aberta{open.length === 1 ? "" : "s"}</span></div>
    {open.length ? <div className="admin31-card-list">{open.map((item) => <article key={text(item.id)} className={`admin31-issue ${text(item.severity)}`}>
      <header><span className="admin31-severity">{text(item.severity)}</span><StatusTag active={text(item.status) === "open"}>{text(item.status)}</StatusTag></header>
      <strong>{text(item.entityLabel) || text(item.entityId)}</strong><p>{text(item.summary)}</p>
      <small>Ocorrências: {number(item.occurrenceCount)} · última leitura {formatDateTime(text(item.lastSeenAt))}{item.impactAmount !== null ? ` · impacto ${formatMoney(number(item.impactAmount))}` : ""}</small>
      <footer><button className="admin-button primary" type="button" disabled={busy === text(item.id) || reason.trim().length < 5} onClick={() => void run(text(item.id), () => reconcile(item), "Correção aplicada e conferência refeita.")}><ShieldCheck /> Revisar correção</button>
        <button className="admin-button" type="button" disabled={busy === text(item.id) || reason.trim().length < 5} onClick={() => void run(text(item.id), () => apiPost("divergence_ignore", { id: item.id, reason }), "Divergência ignorada com justificativa.")}>Ignorar com motivo</button></footer>
    </article>)}</div> : <AdminEmpty><CheckCircle2 /><strong>Nenhuma divergência aberta</strong><span>Pedido, estoque, caixa e cashback passaram nas regras atuais.</span></AdminEmpty>}
  </AdminPanel>;
}

function Guardian({ payload, busy, run }: ModuleProps) {
  const products = rows(payload, "products");
  const campaigns = rows(payload, "campaigns");
  const [campaignId, setCampaignId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [couponPercent, setCouponPercent] = useState(0);
  const [cashbackPercent, setCashbackPercent] = useState(1);
  const [minimumMargin, setMinimumMargin] = useState(10);
  const [result, setResult] = useState<Row | null>(null);
  const product = products.find((item) => text(item.id) === productId);

  async function simulate() {
    if (!product) throw new Error("Selecione um produto.");
    const response = await apiPost("guardian_simulate", { input: {
      campaignId: campaignId || undefined,
      lines: [{ productId, name: text(product.name), price: number(product.price), cost: product.cost_price === null ? null : number(product.cost_price), quantity }],
      coupon: couponPercent > 0 ? { type: "percent", value: couponPercent } : null,
      cashbackPercent, cashbackFixed: 0, shipping: 0, minimumMarginPercent: minimumMargin,
      scenarioKey: `manual-${productId}-${couponPercent}-${cashbackPercent}`, scenarioLabel: `Simulação de ${text(product.name)}`,
    } });
    setResult(response.result as Row);
  }

  return <div className="admin31-two-columns"><AdminPanel title="Simulador financeiro" description="Use o valor final pago, sem frete, para validar desconto + cashback + custo.">
    <div className="admin31-form-grid">
      <label className="wide">Campanha a validar<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)}><option value="">Simulação avulsa</option>{campaigns.map((campaign) => <option key={text(campaign.id)} value={text(campaign.id)}>{text(campaign.name)} · {text(campaign.status)}</option>)}</select></label>
      <label className="wide">Produto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione...</option>{products.map((item) => <option key={text(item.id)} value={text(item.id)}>{text(item.name)} · {formatMoney(number(item.price))}</option>)}</select></label>
      <label>Quantidade<input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} /></label>
      <label>Desconto (%)<input type="number" min={0} max={100} value={couponPercent} onChange={(event) => setCouponPercent(Number(event.target.value))} /></label>
      <label>Cashback (%)<input type="number" min={0} max={100} step="0.1" value={cashbackPercent} onChange={(event) => setCashbackPercent(Number(event.target.value))} /></label>
      <label>Margem mínima (%)<input type="number" min={-100} max={100} step="0.1" value={minimumMargin} onChange={(event) => setMinimumMargin(Number(event.target.value))} /></label>
    </div><div className="admin31-actions"><button className="admin-button primary" disabled={busy === "guardian" || !productId} onClick={() => void run("guardian", simulate, "Simulação registrada no histórico.", false)}><Sparkles /> Simular cenário</button></div>
  </AdminPanel>
  <AdminPanel title="Decisão do guardião" description="Campanhas com custo ausente ou margem abaixo do limite devem ser revisadas.">
    {result ? <div className={`admin31-guardian-result ${text(result.decision)}`}><strong>{text(result.decision).toUpperCase()}</strong><div><span>Total sem frete<b>{formatMoney(number(result.paidProducts))}</b></span><span>Cashback<b>{formatMoney(number(result.cashback))}</b></span><span>Custo<b>{formatMoney(number(result.cost))}</b></span><span>Margem<b>{formatMoney(number(result.margin))} ({number(result.marginPercent).toFixed(1)}%)</b></span></div>{Array.isArray(result.warnings) && result.warnings.length > 0 && <ul>{(result.warnings as string[]).map((warning) => <li key={warning}>{warning}</li>)}</ul>}{campaignId && text(result.decision) !== "blocked" && <button className="admin-button primary" disabled={busy === "publish"} onClick={() => void run("publish", () => apiPost("guardian_publish", { campaignId, simulationId: result.simulationId, reason: "Cenário financeiro revisado e aprovado para publicação." }), "Campanha publicada com a simulação vinculada.")}><Megaphone /> {text(result.decision) === "warning" ? "Autorizar e publicar" : "Publicar campanha"}</button>}</div> : <AdminEmpty><CircleDollarSign /><strong>Pronto para simular</strong><span>Selecione um produto e informe a condição da campanha.</span></AdminEmpty>}
  </AdminPanel></div>;
}

function Continuity({ payload, busy, run }: ModuleProps) {
  const alerts = rows(payload, "alerts");
  const backups = rows(payload, "backups");
  const recoveryTests = rows(payload, "recoveryTests");
  const open = alerts.filter((item) => text(item.status) !== "resolved");
  return <div className="admin31-stack"><div className="admin31-stat-grid">
    <article><AlertTriangle /><span><small>Alertas abertos</small><strong>{open.length}</strong></span></article>
    <article><PackageCheck /><span><small>Último backup</small><strong>{backups[0] ? formatDateTime(text(backups[0].created_at)) : "Pendente"}</strong></span></article>
    <article><RotateCcw /><span><small>Último teste</small><strong>{recoveryTests[0] ? formatDateTime(text(recoveryTests[0].created_at)) : "Pendente"}</strong></span></article>
  </div><AdminPanel title="Saúde e continuidade" description={`Varredura diária às 06:00 (Brasília). Webhook externo: ${payload?.webhookConfigured ? "configurado" : "não configurado"}.`} action={<button className="admin-button primary" disabled={busy === "scan"} onClick={() => void run("scan", () => apiPost("continuity_scan"), "Varredura concluída e alertas atualizados.")}><HeartPulse /> Verificar agora</button>}>
    {open.length ? <div className="admin31-card-list">{open.map((item) => <article key={text(item.id)} className={`admin31-alert ${text(item.severity)}`}><header><strong>{text(item.title)}</strong><StatusTag active={text(item.status) === "open"}>{text(item.status)}</StatusTag></header><p>{text(item.summary)}</p><small>{formatDateTime(text(item.last_seen_at))}</small><footer><button className="admin-button" onClick={() => void run(text(item.id), () => apiPost("continuity_alert_update", { id: item.id, status: "acknowledged" }), "Alerta assumido para acompanhamento.")}>Assumir</button><button className="admin-button primary" onClick={() => void run(text(item.id), () => apiPost("continuity_alert_update", { id: item.id, status: "resolved" }), "Alerta marcado como resolvido.")}>Resolver</button></footer></article>)}</div> : <AdminEmpty><CheckCircle2 /><strong>Operação sem alertas abertos</strong><span>A rotina automática seguirá monitorando divergências, backup e teste de restauração.</span></AdminEmpty>}
  </AdminPanel></div>;
}

function Referrals({ payload, busy, run }: ModuleProps) {
  const confirm = useConfirm();
  const { data } = useAdminData();
  const [catalogDestination, setCatalogDestination] = useState<AdminCatalogDestination>("pharmaceutical");
  const customers = rows(payload, "customers");
  const campaigns = rows(payload, "campaigns");
  const codes = rows(payload, "codes");
  const links = rows(payload, "links");
  const rewards = rows(payload, "rewards");
  const [customerId, setCustomerId] = useState("");
  const [customCode, setCustomCode] = useState("");
  const [copiedCode, setCopiedCode] = useState("");
  const [bonusAmount, setBonusAmount] = useState(50);
  const [bonusReason, setBonusReason] = useState("Bônus adicional por indicação validada pelo atendimento.");
  const currentCampaign = campaigns[0];
  const [form, setForm] = useState(() => ({
    id: text(currentCampaign?.id),
    name: text(currentCampaign?.name) || "Indique e ganhe 10%",
    rewardType: text(currentCampaign?.reward_type) || "percent",
    rewardValue: number(currentCampaign?.reward_value) || 10,
    rewardCap: number(currentCampaign?.reward_cap),
    minimum: number(currentCampaign?.minimum_order_amount),
    validDays: number(currentCampaign?.credit_valid_days) || 90,
    maxTotal: number(currentCampaign?.max_rewards_per_referrer),
    maxMonth: number(currentCampaign?.max_rewards_per_month),
    startsAt: text(currentCampaign?.starts_at) || new Date().toISOString(),
    endsAt: text(currentCampaign?.ends_at),
  }));
  const update = (key: keyof typeof form, next: string | number) => setForm((current) => ({ ...current, [key]: next }));

  async function saveCampaign() {
    await apiPost("referral_campaign_save", { input: {
      id: form.id || undefined, name: form.name, status: "active", startsAt: form.startsAt, endsAt: form.endsAt, rewardType: form.rewardType,
      rewardValue: Number(form.rewardValue), rewardCap: Number(form.rewardCap), creditValidDays: Number(form.validDays),
      maximumPerReferrer: Number(form.maxTotal), maximumPerMonth: Number(form.maxMonth), minimumOrderAmount: Number(form.minimum),
    } });
  }
  async function grantBonus() {
    if (!customerId) throw new Error("Selecione o cliente que receberá o bônus.");
    const preview = await apiPost("referral_bonus_preview", { customerId, amount: bonusAmount, validDays: 90 });
    const confirmation = preview.confirmation as Row;
    const accepted = await confirm({ title: "Liberar bônus manual de indicação?", description: `${text((confirmation.preview as Row)?.customerName)} receberá ${formatMoney(bonusAmount)} por 90 dias. Motivo: ${bonusReason}`, confirmLabel: "Liberar bônus" });
    if (!accepted) return;
    await apiPost("referral_bonus_apply", { customerId, amount: bonusAmount, validDays: 90, confirmationId: confirmation.id, reason: bonusReason });
  }
  async function copyReferralLink(code: string) {
    const href = adminReferralHref(data.tenant, catalogDestination, code);
    if (!href) throw new Error("Não foi possível montar o link de indicação.");
    await navigator.clipboard.writeText(new URL(href, window.location.origin).toString());
    setCopiedCode(code);
  }
  return <div className="admin31-two-columns"><AdminPanel title="Campanha de indicação" description="O indicador recebe cashback somente após a primeira compra do indicado ser quitada.">
    <div className="admin31-form-grid"><label className="wide">Nome<input value={form.name} onChange={(event) => update("name", event.target.value)} /></label><label>Tipo<select value={form.rewardType} onChange={(event) => update("rewardType", event.target.value)}><option value="percent">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>Recompensa<input type="number" min={0.01} value={form.rewardValue} onChange={(event) => update("rewardValue", Number(event.target.value))} /></label><label>Limite por bônus (R$)<input type="number" min={0} value={form.rewardCap} onChange={(event) => update("rewardCap", Number(event.target.value))} /></label><label>Pedido mínimo (R$)<input type="number" min={0} value={form.minimum} onChange={(event) => update("minimum", Number(event.target.value))} /></label><label>Validade do crédito (dias)<input type="number" min={1} value={form.validDays} onChange={(event) => update("validDays", Number(event.target.value))} /></label><label>Máximo por mês<input type="number" min={0} value={form.maxMonth} onChange={(event) => update("maxMonth", Number(event.target.value))} /></label></div>
    <div className="admin31-actions"><button className="admin-button primary" disabled={busy === "campaign"} onClick={() => void run("campaign", saveCampaign, "Campanha de indicação ativada.")}><Megaphone /> Ativar campanha</button></div>
    {campaigns.length > 0 && <p className="admin31-note">Campanha atual: <strong>{text(campaigns[0].name)}</strong> · {text(campaigns[0].status)}</p>}
  </AdminPanel><AdminPanel title="Código e link do cliente" description="Crie o código e copie um link que o aplica automaticamente no checkout. O compartilhamento continua sendo uma ação humana.">
    {hasSeparateCatalogs(data.tenant) && <div className="admin31-form-grid"><label className="wide">Qual loja o link deve abrir?<select value={catalogDestination} onChange={(event) => { setCatalogDestination(event.target.value as AdminCatalogDestination); setCopiedCode(""); }}><option value="pharmaceutical">Catálogo farmacêutico</option><option value="electronics">Eletrônicos — loja principal</option></select><small>Altera somente o destino do link. O código e as regras da campanha continuam iguais.</small></label></div>}
    <div className="admin31-form-grid"><label className="wide">Cliente<select value={customerId} onChange={(event) => setCustomerId(event.target.value)}><option value="">Selecione...</option>{customers.map((customer) => <option value={text(customer.id)} key={text(customer.id)}>{text(customer.name)} · {text(customer.phone)}</option>)}</select></label><label className="wide">Código personalizado (opcional)<input value={customCode} onChange={(event) => setCustomCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} placeholder="Ex.: JUNIOR10" /></label></div>
    <div className="admin31-actions"><button className="admin-button primary" disabled={!customerId || busy === "code"} onClick={() => void run("code", () => apiPost("referral_code_save", { customerId, code: customCode || undefined }), "Código criado e pronto para compartilhar.")}><Gift /> Gerar código</button></div>
    <div className="admin31-form-grid admin31-subform"><label>Prêmio manual (R$)<input type="number" min={0.01} max={100000} value={bonusAmount} onChange={(event) => setBonusAmount(Number(event.target.value))} /></label><label className="wide">Motivo auditável<input value={bonusReason} onChange={(event) => setBonusReason(event.target.value)} maxLength={300} /></label></div><div className="admin31-actions"><button className="admin-button" disabled={!customerId || bonusAmount <= 0 || bonusReason.trim().length < 5 || busy === "bonus"} onClick={() => void run("bonus", grantBonus, "Bônus manual liberado e registrado no extrato.")}><CircleDollarSign /> Liberar prêmio manual</button></div>
    <div className="admin31-mini-list">{codes.slice(0, 8).map((code) => { const value = text(code.code); return <div className="admin31-referral-code" key={text(code.id)}><span><strong>{value}</strong><small>{text(customers.find((customer) => text(customer.id) === text(code.customer_id))?.name) || "Cliente"}</small></span><span className="admin31-referral-link-actions"><button className="admin-button" type="button" onClick={() => void run(`copy-${value}`, () => copyReferralLink(value), "Link copiado e pronto para compartilhar.")} disabled={busy === `copy-${value}`}><Copy /> {copiedCode === value ? "Copiado" : "Copiar link"}</button><a className="admin-button" href={adminReferralHref(data.tenant, catalogDestination, value)} target="_blank" rel="noreferrer"><ExternalLink /> Testar</a></span></div>; })}</div>
  </AdminPanel><AdminPanel title="Resultado do programa" description="Rastreamento, bloqueios e créditos confirmados." ><div className="admin31-stat-grid compact"><article><UsersRound /><span><small>Indicações</small><strong>{links.length}</strong></span></article><article><Gift /><span><small>Créditos liberados</small><strong>{rewards.filter((item) => text(item.status) === "available").length}</strong></span></article><article><CircleDollarSign /><span><small>Valor premiado</small><strong>{formatMoney(rewards.filter((item) => text(item.status) === "available").reduce((sum, item) => sum + number(item.reward_amount), 0))}</strong></span></article></div></AdminPanel></div>;
}

function Bundles({ payload, busy, run }: ModuleProps) {
  const products = rows(payload, "products");
  const bundles = rows(payload, "bundles");
  const [productId, setProductId] = useState("");
  const [name, setName] = useState("Kit degustação");
  const [label, setLabel] = useState("Escolha 4 ampolas");
  const [count, setCount] = useState(4);
  const [allowRepetition, setAllowRepetition] = useState(true);
  const [optionIds, setOptionIds] = useState<string[]>([]);
  const componentProducts = products.filter((product) => text(product.id) !== productId && Boolean(product.active ?? true));

  function toggleOption(id: string) { setOptionIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function save() {
    await apiPost("bundle_save", { input: { productId, name, selectionLabel: label, componentCount: count, allowRepetition, maxPerComponent: allowRepetition ? count : 1, active: true, optionProductIds: optionIds } });
  }
  return <div className="admin31-two-columns"><AdminPanel title="Montar kit configurável" description="O produto do kit mantém o preço; o estoque é reservado e baixado nos componentes escolhidos.">
    <div className="admin31-form-grid"><label className="wide">Produto vendido como kit<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione o esqueleto do kit...</option>{products.map((product) => <option value={text(product.id)} key={text(product.id)}>{text(product.name)}</option>)}</select></label><label>Nome interno<input value={name} onChange={(event) => setName(event.target.value)} /></label><label>Texto para o cliente<input value={label} onChange={(event) => setLabel(event.target.value)} /></label><label>Quantidade de escolhas<input type="number" min={1} max={50} value={count} onChange={(event) => setCount(Math.max(1, Number(event.target.value)))} /></label><label className="admin31-check"><input type="checkbox" checked={allowRepetition} onChange={(event) => setAllowRepetition(event.target.checked)} /> Permitir repetir a mesma opção</label></div>
    <div className="admin31-option-picker"><strong>Produtos disponíveis no kit</strong><div>{componentProducts.map((product) => <label key={text(product.id)} className={optionIds.includes(text(product.id)) ? "selected" : ""}><input type="checkbox" checked={optionIds.includes(text(product.id))} onChange={() => toggleOption(text(product.id))} /><span>{text(product.name)}<small>Estoque {number(product.stock)}</small></span></label>)}</div></div>
    <div className="admin31-actions"><button className="admin-button primary" disabled={!productId || optionIds.length === 0 || busy === "bundle"} onClick={() => void run("bundle", save, "Kit publicado e estoque virtual recalculado.")}><Boxes /> Publicar kit</button></div>
  </AdminPanel><AdminPanel title="Kits publicados" description="A versão é preservada no pedido para auditoria futura.">{bundles.length ? <div className="admin31-card-list">{bundles.map((bundle) => <article key={text(bundle.id)}><header><strong>{text(bundle.name)}</strong><StatusTag active={Boolean(bundle.active)}>v{number(bundle.version)}</StatusTag></header><p>{text(bundle.product_name)} · {number(bundle.component_count)} escolhas</p><small>{Array.isArray(bundle.options) ? (bundle.options as Row[]).map((option) => text(option.product_name)).join(" · ") : ""}</small></article>)}</div> : <AdminEmpty><Boxes /><strong>Nenhum kit configurado</strong><span>Cadastre o produto principal antes de montar as opções.</span></AdminEmpty>}</AdminPanel></div>;
}

function Funnel({ payload, busy, run }: ModuleProps) {
  const metrics = rows(payload, "metrics");
  const carts = rows(payload, "carts").filter((cart) => !["recovered", "dismissed"].includes(text(cart.status)));
  return <div className="admin31-stack"><div className="admin31-funnel">{metrics.map((metric, index) => <article key={text(metric.stage)}><span>{index + 1}</span><div><small>{stageLabels[text(metric.stage)] || text(metric.stage)}</small><strong>{number(metric.sessions)}</strong><p>{number(metric.conversionFromPrevious).toFixed(1)}% da etapa anterior</p></div></article>)}</div><AdminPanel title="Oportunidades de recuperação" description="O sistema organiza a fila; nenhuma mensagem é enviada automaticamente.">
    {carts.length ? <div className="admin31-card-list">{carts.slice(0, 50).map((cart) => { const phone = text(cart.customer_phone); const message = `Olá, ${text(cart.customer_name) || "tudo bem"}? Vi que você iniciou um pedido na Junior Imports. Posso ajudar a concluir?`; return <article key={text(cart.id)}><header><strong>{text(cart.customer_name) || "Visitante"}</strong><StatusTag active={text(cart.status) === "active"}>{text(cart.status)}</StatusTag></header><p>{number(cart.item_count)} itens · {formatMoney(number(cart.subtotal))}</p><small>Última atividade: {formatDateTime(text(cart.last_activity_at))}</small><footer>{phone && <a className="admin-button primary" href={whatsappUrl(phone, message)} target="_blank" rel="noreferrer" onClick={() => void apiPost("funnel_cart_update", { id: cart.id, status: "contacted", reason: "Contato aberto manualmente" })}><MessageCircle /> Abrir WhatsApp <ExternalLink /></a>}<button className="admin-button" disabled={busy === text(cart.id)} onClick={() => void run(text(cart.id), () => apiPost("funnel_cart_update", { id: cart.id, status: "snoozed", delayHours: 24, reason: "Revisar amanhã" }), "Oportunidade adiada por 24 horas.")}>Lembrar amanhã</button><button className="admin-button" onClick={() => void run(text(cart.id), () => apiPost("funnel_cart_update", { id: cart.id, status: "dismissed", reason: "Sem interesse após revisão" }), "Oportunidade encerrada.")}>Encerrar</button></footer></article>; })}</div> : <AdminEmpty><CheckCircle2 /><strong>Nenhuma oportunidade pendente</strong><span>Novos carrinhos serão organizados automaticamente por etapa.</span></AdminEmpty>}
  </AdminPanel></div>;
}

function Flags({ payload, busy, run }: ModuleProps) {
  const confirm = useConfirm();
  const flags = rows(payload, "flags");
  const [reason, setReason] = useState("Liberação revisada para a operação oficial.");
  async function toggle(flag: Row, killSwitch = false) {
    const enabled = killSwitch ? Boolean(flag.enabled) : !Boolean(flag.enabled);
    const nextKill = killSwitch ? !Boolean(flag.kill_switch) : Boolean(flag.kill_switch);
    const accepted = await confirm({ title: killSwitch ? "Alterar interrupção de emergência?" : "Alterar disponibilidade do recurso?", description: `${text(flag.name)}. Motivo registrado: ${reason}`, confirmLabel: "Confirmar alteração", danger: killSwitch && nextKill });
    if (!accepted) return;
    await apiPost("flag_update", { id: flag.id, enabled, killSwitch: nextKill, rolloutPercentage: number(flag.rollout_percentage), reason });
  }
  return <AdminPanel title="Liberação controlada" description="Desative um módulo sem novo deploy; o interruptor de emergência tem prioridade.">
    <div className="admin31-inline-field"><label>Motivo da alteração<input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} /></label></div>
    <div className="admin31-flag-grid">{flags.map((flag) => <article key={text(flag.id)} className={Boolean(flag.kill_switch) ? "killed" : Boolean(flag.enabled) ? "enabled" : "disabled"}><header><Flag /><span><strong>{text(flag.name)}</strong><small>{text(flag.key)}</small></span><StatusTag active={Boolean(flag.enabled) && !Boolean(flag.kill_switch)}>{Boolean(flag.kill_switch) ? "interrompido" : Boolean(flag.enabled) ? "ativo" : "inativo"}</StatusTag></header><p>{text(flag.description)}</p><div><span>Liberação <b>{number(flag.rollout_percentage)}%</b></span><span>Ambiente <b>{text(flag.environment)}</b></span></div><footer><button className="admin-button" disabled={busy === text(flag.id) || reason.trim().length < 5} onClick={() => void run(text(flag.id), () => toggle(flag), "Disponibilidade atualizada.")}>{Boolean(flag.enabled) ? "Desativar" : "Ativar"}</button><button className="admin-button danger" disabled={busy === text(flag.id) || reason.trim().length < 5} onClick={() => void run(text(flag.id), () => toggle(flag, true), "Interruptor de emergência atualizado.")}>{Boolean(flag.kill_switch) ? "Remover interrupção" : "Interromper agora"}</button></footer></article>)}</div>
  </AdminPanel>;
}

function MobileOperations({ payload, busy, run }: ModuleProps) {
  const confirm = useConfirm();
  const products = rows(payload, "products");
  const barcodes = rows(payload, "barcodes");
  const movements = rows(payload, "inventoryMovements");
  const drafts = rows(payload, "drafts");
  const [productId, setProductId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const [transcript, setTranscript] = useState("");
  const [voiceDraft, setVoiceDraft] = useState<ReturnType<typeof parseMobileOperationDraft> | null>(null);
  const [reversalReason, setReversalReason] = useState("Lançamento conferido e registrado de forma incorreta.");
  const voiceSupported = useMemo(() => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window), []);

  useEffect(() => {
    const match = barcodes.find((item) => text(item.barcode) === barcode && Boolean(item.active));
    if (match) setProductId(text(match.product_id));
  }, [barcode, barcodes]);

  const stopScanner = useCallback(() => {
    if (scanFrameRef.current !== null) cancelAnimationFrame(scanFrameRef.current);
    scanFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopScanner(), [stopScanner]);

  async function startScanner() {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) { setCameraError("A câmera não está disponível neste navegador."); return; }
    type Detection = { rawValue?: string };
    type Detector = { detect: (source: HTMLVideoElement) => Promise<Detection[]> };
    const scope = window as unknown as { BarcodeDetector?: new (options?: { formats?: string[] }) => Detector };
    if (!scope.BarcodeDetector) { setCameraError("O leitor automático não é compatível com este navegador. Digite o código abaixo."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream; setScanning(true);
      const video = videoRef.current;
      if (!video) { stopScanner(); return; }
      video.srcObject = stream; await video.play();
      const detector = new scope.BarcodeDetector({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
      let detecting = false;
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return;
        if (!detecting && video.readyState >= 2) {
          detecting = true;
          try {
            const found = await detector.detect(video);
            const raw = found.find((item) => item.rawValue)?.rawValue?.trim();
            if (raw) { setBarcode(raw); stopScanner(); return; }
          } catch { /* mantém a câmera ativa para a próxima leitura */ }
          finally { detecting = false; }
        }
        scanFrameRef.current = requestAnimationFrame(() => void scan());
      };
      scanFrameRef.current = requestAnimationFrame(() => void scan());
    } catch (caught) {
      stopScanner();
      setCameraError(caught instanceof Error && caught.name === "NotAllowedError" ? "A permissão da câmera foi negada. Você ainda pode digitar o código." : "Não foi possível iniciar a câmera.");
    }
  }

  function startVoice() {
    type Recognition = { lang: string; interimResults: boolean; continuous: boolean; onresult: (event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void; onerror: () => void; start: () => void };
    const scope = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Constructor) return;
    const recognition = new Constructor(); recognition.lang = "pt-BR"; recognition.interimResults = false; recognition.continuous = false;
    recognition.onresult = (event) => { const spoken = event.results[0]?.[0]?.transcript ?? ""; setTranscript(spoken); setVoiceDraft(parseMobileOperationDraft(spoken)); };
    recognition.onerror = () => setVoiceDraft(parseMobileOperationDraft(transcript)); recognition.start();
  }

  async function saveVoiceDraft() {
    const draft = voiceDraft ?? parseMobileOperationDraft(transcript);
    await apiPost("mobile_draft_save", { source: "voice", intent: draft.intent, transcript, payload: draft });
  }

  async function saveBarcode() {
    const product = products.find((item) => text(item.id) === productId);
    const accepted = await confirm({ title: "Associar código ao produto?", description: `${barcode} será associado a ${text(product?.name)}. Isso não movimenta o estoque.`, confirmLabel: "Associar código" });
    if (!accepted) return;
    await apiPost("mobile_barcode_save", { productId, barcode, symbology: "manual_or_device" });
  }

  async function reverseMovement(movement: Row) {
    const preview = await apiPost("reversal_preview", { originalType: "inventory_movement", originalId: movement.id });
    const confirmation = preview.confirmation as Row;
    const accepted = await confirm({ title: "Criar movimento compensatório?", description: `O histórico original será mantido. Motivo: ${reversalReason}`, confirmLabel: "Confirmar reversão", danger: true });
    if (!accepted) return;
    await apiPost("reversal_apply", { originalType: "inventory_movement", originalId: movement.id, confirmationId: confirmation.id, reason: reversalReason });
  }

  return <div className="admin31-two-columns"><AdminPanel title="Código de barras" description="Associe o código físico ao produto para buscas rápidas no celular."><div className={`admin31-camera ${scanning ? "active" : ""}`} aria-hidden={!scanning}><video ref={videoRef} muted playsInline aria-label="Imagem da câmera para leitura do código" /><span>Posicione o código no centro da imagem.</span></div><div className="admin31-form-grid"><label className="wide">Produto<select value={productId} onChange={(event) => setProductId(event.target.value)}><option value="">Selecione...</option>{products.map((product) => <option value={text(product.id)} key={text(product.id)}>{text(product.name)} · estoque {number(product.stock)}</option>)}</select></label><label className="wide">Código lido ou digitado<input inputMode="numeric" value={barcode} onChange={(event) => setBarcode(event.target.value.trim())} placeholder="EAN, QR ou código interno" /></label></div>{cameraError && <p className="admin31-camera-error">{cameraError}</p>}<div className="admin31-actions"><button className="admin-button" type="button" onClick={scanning ? stopScanner : () => void startScanner()}><Barcode /> {scanning ? "Fechar câmera" : "Ler com a câmera"}</button><button className="admin-button primary" disabled={!productId || barcode.length < 4 || busy === "barcode"} onClick={() => void run("barcode", saveBarcode, "Código associado ao produto.")}><Barcode /> Salvar associação</button></div></AdminPanel>
  <AdminPanel title="Voz como rascunho" description="A voz interpreta a intenção, mas nunca movimenta estoque nem dinheiro sozinha."><div className="admin31-voice"><textarea value={transcript} onChange={(event) => { setTranscript(event.target.value); setVoiceDraft(parseMobileOperationDraft(event.target.value)); }} placeholder="Ex.: registrar perda de 2 unidades do produto..." /><button className="admin-button" type="button" disabled={!voiceSupported} onClick={startVoice}><Mic /> {voiceSupported ? "Ditar" : "Voz indisponível"}</button></div>{voiceDraft && <div className="admin31-draft-preview"><strong>{voiceDraft.action}</strong><span>{voiceDraft.entity || "Produto ainda não identificado"}</span><small>{voiceDraft.ambiguous ? "Exige revisão antes de continuar" : "Rascunho pronto para salvar"}</small></div>}<div className="admin31-actions"><button className="admin-button primary" disabled={!transcript.trim() || busy === "voice"} onClick={() => void run("voice", saveVoiceDraft, "Rascunho salvo; nenhuma movimentação foi executada.")}><Save /> Salvar rascunho</button></div><p className="admin31-note">{drafts.length} rascunho{drafts.length === 1 ? "" : "s"} recente{drafts.length === 1 ? "" : "s"} no dispositivo.</p></AdminPanel>
  <AdminPanel title="Desfazer com rastreabilidade" description="A reversão cria um lançamento compensatório e preserva o original."><div className="admin31-inline-field"><label>Motivo<input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} /></label></div><div className="admin31-mini-list movement-list">{movements.slice(0, 12).map((movement) => <div key={text(movement.id)}><span><strong>{text(products.find((product) => text(product.id) === text(movement.product_id))?.name) || text(movement.product_id)}</strong><small>{text(movement.type)} · {number(movement.quantity)} un. · {formatDateTime(text(movement.created_at))}</small></span><button className="admin-button danger" disabled={busy === text(movement.id) || reversalReason.trim().length < 5} onClick={() => void run(text(movement.id), () => reverseMovement(movement), "Movimento compensatório criado.")}><RotateCcw /> Desfazer</button></div>)}</div></AdminPanel></div>;
}
