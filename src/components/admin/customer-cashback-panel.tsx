"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarClock, Coins, History, ShieldCheck, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { cashbackEntryState, cashbackWalletSummary, isCashbackCredit } from "@/lib/cashback";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cashbackAdjustmentSchema } from "@/lib/validation";
import type { CashbackEntry, CustomerInsight } from "@/types/store";
import { useAdminData } from "./admin-data-provider";

const entryLabels: Record<CashbackEntry["kind"], string> = {
  order_credit: "Crédito de pedido",
  campaign_bonus: "Bônus de campanha",
  adjustment_credit: "Ajuste de crédito",
  redemption: "Uso de cashback",
  adjustment_debit: "Ajuste de débito",
  order_reversal: "Estorno de pedido",
};

const stateLabels = { available: "Disponível", used: "Utilizado", expired: "Expirado", posted: "Registrado" };

export function CustomerCashbackPanel({ customer }: { customer: CustomerInsight }) {
  const { data, adjustCustomerCashback } = useAdminData();
  const [mode, setMode] = useState<"credit" | "debit">("credit");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [validDays, setValidDays] = useState(90);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const entries = useMemo(() => data.cashbackEntries.filter((entry) => entry.customerId === customer.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [customer.id, data.cashbackEntries]);
  const summary = useMemo(() => cashbackWalletSummary(entries), [entries]);
  const persistedCustomer = data.customers.some((item) => item.id === customer.id);

  async function submit() {
    const numericAmount = Number(amount.replace(",", "."));
    const parsed = cashbackAdjustmentSchema.safeParse({ customerId: customer.id, amount: mode === "credit" ? numericAmount : -numericAmount, reason, validDays });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise o ajuste.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await adjustCustomerCashback(parsed.data);
      setAmount("");
      setReason("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível registrar o ajuste.");
    } finally {
      setSaving(false);
    }
  }

  return <section className="customer-cashback-wallet">
    <header><div className="customer-wallet-title"><span><WalletCards /></span><div><small>CARTEIRA DE CASHBACK</small><h3>{formatMoney(summary.available)} disponíveis</h3><p>Ledger protegido: correções sempre geram um novo lançamento.</p></div></div>{summary.expiringSoon > 0 && <div className="customer-wallet-alert"><CalendarClock /><span><strong>{formatMoney(summary.expiringSoon)}</strong> vencem em até 30 dias</span></div>}</header>
    <div className="customer-wallet-metrics"><article><span>Créditos</span><strong>{formatMoney(summary.credited)}</strong></article><article><span>Utilizado</span><strong>{formatMoney(summary.redeemed)}</strong></article><article><span>Ajustes</span><strong>{summary.adjusted >= 0 ? "+" : ""}{formatMoney(summary.adjusted)}</strong></article><article><span>Expirado</span><strong>{formatMoney(summary.expired)}</strong></article></div>
    <div className="customer-wallet-layout">
      <form className="customer-wallet-adjustment" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        <div><strong>Ajuste administrativo</strong><span>Exige motivo e fica registrado na auditoria.</span></div>
        <div className="customer-wallet-mode"><button type="button" className={mode === "credit" ? "active" : ""} onClick={() => setMode("credit")}><ArrowUpRight /> Adicionar</button><button type="button" className={mode === "debit" ? "active debit" : ""} onClick={() => setMode("debit")}><ArrowDownLeft /> Debitar</button></div>
        <label>Valor (R$)<input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" disabled={!persistedCustomer} /></label>
        {mode === "credit" && <label>Validade<select value={validDays} onChange={(event) => setValidDays(Number(event.target.value))}><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option><option value={365}>1 ano</option></select></label>}
        <label className="full">Motivo<textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: correção autorizada pelo atendimento" disabled={!persistedCustomer} /></label>
        {!persistedCustomer && <p className="customer-wallet-notice"><ShieldCheck /> Salve este cliente antes de movimentar a carteira.</p>}
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <button className={`admin-button ${mode === "debit" ? "danger" : "primary"}`} disabled={saving || !persistedCustomer}>{saving ? "Registrando..." : mode === "credit" ? "Registrar crédito" : "Registrar débito"}</button>
      </form>
      <div className="customer-wallet-statement"><header><div><History /><span><strong>Extrato completo</strong><small>{entries.length} lançamento{entries.length === 1 ? "" : "s"}</small></span></div></header><div>
        {entries.map((entry) => {
          const state = cashbackEntryState(entry);
          const credit = isCashbackCredit(entry.kind);
          const order = data.orders.find((item) => item.id === entry.orderId);
          const campaign = data.cashbackCampaigns.find((item) => item.id === entry.campaignId);
          return <article key={entry.id} className={`${credit ? "credit" : "debit"} ${state}`}><span className="customer-wallet-entry-icon">{credit ? <ArrowUpRight /> : <ArrowDownLeft />}</span><div><strong>{entryLabels[entry.kind]}</strong><p>{entry.description}</p><small>{formatDateTime(entry.createdAt)}{order ? ` · ${order.code}` : ""}{campaign ? ` · ${campaign.name}` : ""}</small>{credit && entry.expiresAt && <small>Validade: {formatDateTime(entry.expiresAt)} · {stateLabels[state]}</small>}</div><b>{credit ? "+" : "−"} {formatMoney(entry.amount)}</b></article>;
        })}
        {!entries.length && <div className="customer-wallet-empty"><Coins /><strong>Carteira ainda sem movimentos</strong><span>O crédito será criado quando um pedido com cashback for confirmado.</span></div>}
      </div></div>
    </div>
  </section>;
}
