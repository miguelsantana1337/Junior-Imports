"use client";

import { IconAlertTriangle, IconCash, IconCheck, IconPlus, IconReceipt2, IconTrendingUp, IconWallet } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { financialSummary, productProfit } from "@/lib/operations";
import { financialTransactionSchema } from "@/lib/validation";
import type { FinancialTransaction } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel } from "./admin-ui";

const statusLabels: Record<FinancialTransaction["status"], string> = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };

export function FinanceAdmin() {
  const { data, saveFinancialTransaction, deleteFinancialTransaction } = useAdminData();
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | FinancialTransaction["type"]>("all");
  const [error, setError] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<FinancialTransaction>(() => ({ id: crypto.randomUUID(), type: "expense", status: "pending", description: "", amount: 0, category: "Operacional", account: "Conta principal", costCenter: "Administração", dueDate: today, paidAt: "", orderId: "", purchaseOrderId: "", recurring: false, notes: "", createdAt: new Date().toISOString() }));
  const summary = useMemo(() => financialSummary(data.financialTransactions), [data.financialTransactions]);
  const transactions = data.financialTransactions.filter((item) => filter === "all" || item.type === filter);
  const profitableProducts = data.products.map((product) => ({ product, ...productProfit(product) })).sort((a, b) => b.marginPercent - a.marginPercent).slice(0, 6);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const candidate = { ...form, paidAt: form.status === "paid" ? form.paidAt || new Date().toISOString() : "" };
    const parsed = financialTransactionSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise o lançamento."); return; }
    await saveFinancialTransaction(candidate);
    setForm({ id: crypto.randomUUID(), type: "expense", status: "pending", description: "", amount: 0, category: "Operacional", account: "Conta principal", costCenter: "Administração", dueDate: today, paidAt: "", orderId: "", purchaseOrderId: "", recurring: false, notes: "", createdAt: new Date().toISOString() });
    setFormOpen(false); setError("");
  }

  return <div className="ops-page">
    <section className="ops-hero"><div><span>FINANCEIRO</span><h2>Caixa, custos e lucro em uma única visão.</h2><p>Os pedidos alimentam o resultado automaticamente e os lançamentos manuais completam a operação.</p></div><div className="ops-hero-actions"><button className="admin-button primary" onClick={() => setFormOpen((value) => !value)}><IconPlus /> Novo lançamento</button></div></section>
    <section className="ops-metric-grid finance">
      <article><span className="green"><IconTrendingUp /></span><div><small>Receita realizada</small><strong>{formatMoney(summary.income)}</strong><p>{formatMoney(summary.receivable)} a receber</p></div></article>
      <article><span className="danger"><IconReceipt2 /></span><div><small>Saídas realizadas</small><strong>{formatMoney(summary.expenses)}</strong><p>{formatMoney(summary.payable)} a pagar</p></div></article>
      <article><span className={summary.netProfit >= 0 ? "blue" : "danger"}><IconCash /></span><div><small>Lucro líquido</small><strong>{formatMoney(summary.netProfit)}</strong><p>{summary.marginPercent.toFixed(1)}% de margem</p></div></article>
      <article><span className={summary.overdue > 0 ? "warning" : "green"}><IconAlertTriangle /></span><div><small>Vencido</small><strong>{formatMoney(summary.overdue)}</strong><p>projeção {formatMoney(summary.projectedBalance)}</p></div></article>
    </section>

    {formOpen && <AdminPanel title="Adicionar entrada ou saída" description="Registre valores manuais com vencimento, conta e centro de custo."><form className="ops-form" onSubmit={submit}>
      <label>Tipo<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FinancialTransaction["type"] }))}><option value="income">Entrada</option><option value="expense">Saída</option></select></label>
      <label>Situação<select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as FinancialTransaction["status"] }))}><option value="pending">Pendente</option><option value="paid">Pago</option></select></label>
      <label className="wide">Descrição<input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: embalagem, aluguel ou recebimento" /></label>
      <label>Valor (R$)<input type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: Number(event.target.value) }))} /></label>
      <label>Vencimento<input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} /></label>
      <label>Categoria<input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} /></label>
      <label>Conta<input value={form.account} onChange={(event) => setForm((current) => ({ ...current, account: event.target.value }))} /></label>
      <label>Centro de custo<input value={form.costCenter} onChange={(event) => setForm((current) => ({ ...current, costCenter: event.target.value }))} /></label>
      <label className="check-line"><input type="checkbox" checked={form.recurring} onChange={(event) => setForm((current) => ({ ...current, recurring: event.target.checked }))} /> Lançamento recorrente</label>
      <label className="wide">Observações<textarea rows={3} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
      {error && <p className="admin-form-error wide" role="alert">{error}</p>}
      <div className="ops-form-actions wide"><button type="button" className="admin-button" onClick={() => setFormOpen(false)}>Cancelar</button><button className="admin-button primary">Salvar lançamento</button></div>
    </form></AdminPanel>}

    <div className="ops-two-columns">
      <AdminPanel title="Fluxo financeiro" description="Entradas e saídas automáticas ou manuais.">
        <div className="ops-tabs compact"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "income" ? "active" : ""} onClick={() => setFilter("income")}>Entradas</button><button className={filter === "expense" ? "active" : ""} onClick={() => setFilter("expense")}>Saídas</button></div>
        <div className="finance-list">{transactions.map((item) => <article key={item.id}><span className={item.type}>{item.type === "income" ? "+" : "−"}</span><div><strong>{item.description}</strong><small>{item.category} · {item.account} · venc. {item.dueDate || "sem data"}</small>{item.orderId && <em>Gerado por pedido</em>}{item.purchaseOrderId && <em>Gerado por compra</em>}</div><div><b>{item.type === "income" ? "+ " : "- "}{formatMoney(item.amount)}</b><small className={`finance-status ${item.status}`}>{statusLabels[item.status]}</small></div><div className="ops-row-actions">{item.status === "pending" && <button className="admin-icon-button" aria-label={`Marcar ${item.description} como pago`} onClick={() => void saveFinancialTransaction({ ...item, status: "paid", paidAt: new Date().toISOString() })}><IconCheck /></button>}{!item.orderId && !item.purchaseOrderId && <button className="admin-icon-button" aria-label={`Excluir ${item.description}`} onClick={() => void deleteFinancialTransaction(item.id)}>×</button>}</div></article>)}{!transactions.length && <AdminEmpty><IconWallet /><strong>Nenhum lançamento.</strong><span>Adicione uma entrada ou saída para começar.</span></AdminEmpty>}</div>
      </AdminPanel>

      <div className="ops-side-stack">
        <section className="ops-profit-card"><header><div><span>RESULTADO</span><h3>DRE gerencial</h3></div><IconCash /></header><dl><div><dt>Receita realizada</dt><dd>{formatMoney(summary.income)}</dd></div><div><dt>(−) Custos e despesas</dt><dd>- {formatMoney(summary.expenses)}</dd></div><div className="total"><dt>Lucro líquido</dt><dd>{formatMoney(summary.netProfit)}</dd></div></dl><footer><span>Margem líquida</span><strong>{summary.marginPercent.toFixed(1)}%</strong></footer></section>
        <section className="ops-profitability"><header><div><h3>Margem por produto</h3><p>Com base no custo cadastrado.</p></div></header>{profitableProducts.map(({ product, grossProfit, marginPercent }) => <article key={product.id}><div><strong>{product.name}</strong><small>{formatMoney(grossProfit)} por unidade</small></div><span>{product.costPrice > 0 ? `${marginPercent.toFixed(1)}%` : "Sem custo"}</span></article>)}</section>
      </div>
    </div>
  </div>;
}
