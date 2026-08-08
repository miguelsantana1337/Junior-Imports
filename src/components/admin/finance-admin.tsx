"use client";

import { IconCalendarEvent, IconCash, IconCheck, IconPlus, IconReceipt2, IconTrendingUp, IconWallet } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { formatMoney, formatStoreDateKey } from "@/lib/format";
import { financialSummary } from "@/lib/operations";
import { financialTransactionSchema } from "@/lib/validation";
import { historicalFinancialTransactions, officialFinancialTransactions, officialOrders, operationStartLabel } from "@/lib/operation-scope";
import { isOrderArchived, orderFinancialTotal } from "@/lib/order-finance";
import { orderOperationalStatus, orderPaymentStatus } from "@/lib/order-lifecycle";
import type { FinancialTransaction } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel } from "./admin-ui";

const statusLabels: Record<FinancialTransaction["status"], string> = { pending: "Pendente", paid: "Pago", cancelled: "Cancelado" };

export function FinanceAdmin() {
  const { data, referenceNow, saveFinancialTransaction, deleteFinancialTransaction } = useAdminData();
  const [formOpen, setFormOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | FinancialTransaction["type"]>("all");
  const [scope, setScope] = useState<"official" | "history">("official");
  const [error, setError] = useState("");
  const today = formatStoreDateKey(referenceNow);
  const [form, setForm] = useState<FinancialTransaction>(() => ({ id: crypto.randomUUID(), type: "expense", status: "pending", description: "", amount: 0, category: "Operacional", account: "Conta principal", costCenter: "Administração", dueDate: today, paidAt: "", orderId: "", purchaseOrderId: "", recurring: false, notes: "", createdAt: new Date().toISOString() }));
  const operationTransactions = useMemo(() => officialFinancialTransactions(data.financialTransactions, data.settings), [data.financialTransactions, data.settings]);
  const historyTransactions = useMemo(() => historicalFinancialTransactions(data.financialTransactions, data.settings), [data.financialTransactions, data.settings]);
  const summary = useMemo(() => financialSummary(operationTransactions), [operationTransactions]);
  const receivable = useMemo(() => officialOrders(data.orders, data.settings)
    .filter((order) => !isOrderArchived(order, new Date(referenceNow)))
    .filter((order) => orderOperationalStatus(order) !== "Cancelado" && ["Pendente", "Parcial"].includes(orderPaymentStatus(order)))
    .reduce((total, order) => total + orderFinancialTotal(order), 0), [data.orders, data.settings, referenceNow]);
  const transactions = (scope === "official" ? operationTransactions : historyTransactions).filter((item) => filter === "all" || item.type === filter);
  const operationDate = operationStartLabel(data.settings);

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
    <section className="ops-hero"><div><span>CAIXA E RESULTADOS</span><h2>Veja o que entrou, saiu e ainda precisa entrar.</h2><p>Os pedidos atualizam o caixa automaticamente. Registre aqui somente o que acontecer fora deles.</p></div><div className="ops-hero-actions"><button className="admin-button primary" onClick={() => setFormOpen((value) => !value)}><IconPlus /> Registrar entrada ou saída</button></div></section>
    {operationDate && <div className="operation-baseline-note"><IconCalendarEvent /><div><strong>Financeiro oficial desde {operationDate}</strong><span>Os indicadores e os relatórios não somam lançamentos anteriores. Use “Histórico anterior” apenas para consulta.</span></div></div>}
    <section className="ops-metric-grid finance">
      <article><span className="green"><IconTrendingUp /></span><div><small>Entrou</small><strong className="admin-money-value">{formatMoney(summary.income)}</strong><p>pagamentos confirmados</p></div></article>
      <article><span className="blue"><IconWallet /></span><div><small>Ainda vai entrar</small><strong className="admin-money-value">{formatMoney(receivable)}</strong><p>pedidos ativos com pagamento pendente</p></div></article>
      <article><span className="danger"><IconReceipt2 /></span><div><small>Saiu</small><strong className="admin-money-value">{formatMoney(summary.expenses)}</strong><p>custos, despesas e taxas</p></div></article>
      <article><span className={summary.netProfit >= 0 ? "blue" : "danger"}><IconCash /></span><div><small>Sobrou</small><strong className="admin-money-value">{formatMoney(summary.netProfit)}</strong><p>{summary.marginPercent.toFixed(1)}% do que entrou</p></div></article>
    </section>

    {formOpen && <AdminPanel title="O dinheiro entrou ou saiu?" description="Informe apenas os dados essenciais; detalhes adicionais continuam opcionais."><form className="ops-form" onSubmit={submit}>
      <label>Movimento<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as FinancialTransaction["type"] }))}><option value="income">Entrou</option><option value="expense">Saiu</option></select></label>
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
      <AdminPanel title="Extrato de movimentações" description="Todas as entradas e saídas, automáticas ou manuais.">
        {operationDate && <div className="operation-scope-tabs"><button className={scope === "official" ? "active" : ""} onClick={() => setScope("official")}>Operação oficial <b>{operationTransactions.length}</b></button><button className={scope === "history" ? "active" : ""} onClick={() => setScope("history")}>Histórico anterior <b>{historyTransactions.length}</b></button></div>}
        <div className="ops-tabs compact"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button><button className={filter === "income" ? "active" : ""} onClick={() => setFilter("income")}>Entradas</button><button className={filter === "expense" ? "active" : ""} onClick={() => setFilter("expense")}>Saídas</button></div>
        <div className="finance-list">{transactions.map((item) => <article key={item.id}><span className={item.type}>{item.type === "income" ? "+" : "−"}</span><div><strong>{item.description}</strong><small>{item.category} · {item.account} · venc. {item.dueDate || "sem data"}</small>{item.orderId && <em>Gerado por pedido</em>}{item.purchaseOrderId && <em>Gerado por compra</em>}</div><div><b className="admin-money-value">{item.type === "income" ? "+ " : "- "}{formatMoney(item.amount)}</b><small className={`finance-status ${item.status}`}>{statusLabels[item.status]}</small></div><div className="ops-row-actions">{item.status === "pending" && <button className="admin-icon-button" aria-label={`Marcar ${item.description} como pago`} onClick={() => void saveFinancialTransaction({ ...item, status: "paid", paidAt: new Date().toISOString() })}><IconCheck /></button>}{!item.orderId && !item.purchaseOrderId && <button className="admin-icon-button" aria-label={`Excluir ${item.description}`} onClick={() => void deleteFinancialTransaction(item.id)}>×</button>}</div></article>)}{!transactions.length && <AdminEmpty><IconWallet /><strong>{scope === "history" ? "Nenhum lançamento no histórico anterior." : "Nenhum lançamento na operação oficial."}</strong><span>{scope === "history" ? "Os registros anteriores continuam preservados quando existirem." : "As novas entradas e saídas aparecerão aqui a partir do início oficial."}</span></AdminEmpty>}</div>
      </AdminPanel>

      <div className="ops-side-stack">
        <section className="ops-profit-card"><header><div><span>RESULTADO</span><h3>Resumo do resultado</h3></div><IconCash /></header><dl><div><dt>Entrou</dt><dd className="admin-money-value">{formatMoney(summary.income)}</dd></div><div><dt>(−) Saiu</dt><dd className="admin-money-value">- {formatMoney(summary.expenses)}</dd></div><div className="total"><dt>Sobrou</dt><dd className="admin-money-value">{formatMoney(summary.netProfit)}</dd></div></dl><footer><span>Percentual que sobrou</span><strong>{summary.marginPercent.toFixed(1)}%</strong></footer></section>
      </div>
    </div>
  </div>;
}
