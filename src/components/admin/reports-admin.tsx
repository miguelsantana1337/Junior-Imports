"use client";

import { BarChart3, CalendarRange, Check, Download, FileClock, FileSpreadsheet, FileText, History, LineChart, LockKeyhole, Plus, Save, Share2, Sparkles, Trash2, TrendingDown, TrendingUp, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { formatDateTime, formatMoney } from "@/lib/format";
import { downloadReportFile } from "@/lib/report-export";
import { buildReport, reportTypeLabels, type ReportQuery, type ReportValueFormat } from "@/lib/reporting";
import { savedReportSchema } from "@/lib/validation";
import type { ExportRun, ReportFormat, ReportType, SavedReport } from "@/types/store";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty } from "./admin-ui";

type ReportTab = "builder" | "saved" | "exports";

const reportFilterOptions: Record<ReportType, Array<{ value: string; label: string }>> = {
  sales: [{ value: "all", label: "Todos os pedidos" }, { value: "status:Novo", label: "Status: Novo" }, { value: "status:Pago", label: "Status: Pago" }, { value: "status:Enviado", label: "Status: Enviado" }, { value: "status:Cancelado", label: "Status: Cancelado" }, { value: "source:storefront", label: "Origem: Loja" }, { value: "source:admin", label: "Origem: Painel" }],
  finance: [{ value: "all", label: "Todos os lançamentos" }, { value: "type:income", label: "Somente entradas" }, { value: "type:expense", label: "Somente saídas" }, { value: "status:paid", label: "Status: Pago" }, { value: "status:pending", label: "Status: Pendente" }],
  inventory: [{ value: "all", label: "Todo o estoque" }, { value: "severity:critical", label: "Ruptura prevista" }, { value: "severity:warning", label: "Ponto de reposição" }, { value: "reorder", label: "Compra sugerida" }, { value: "slow", label: "Sem giro" }],
  customers: [{ value: "all", label: "Todos os clientes" }, { value: "segment:new", label: "Novos" }, { value: "segment:active", label: "Ativos" }, { value: "segment:recurring", label: "Recorrentes" }, { value: "segment:vip", label: "VIP" }, { value: "segment:at_risk", label: "Em risco" }, { value: "segment:inactive", label: "Inativos" }],
  cashback: [{ value: "all", label: "Todos os movimentos" }, { value: "kind:order_credit", label: "Crédito de pedido" }, { value: "kind:campaign_bonus", label: "Bônus de campanha" }, { value: "kind:spend", label: "Consumo" }, { value: "kind:expiry", label: "Expiração" }, { value: "kind:adjustment_credit", label: "Ajuste de crédito" }, { value: "kind:adjustment_debit", label: "Ajuste de débito" }],
  purchases: [{ value: "all", label: "Todas as ordens" }, { value: "status:draft", label: "Rascunhos" }, { value: "status:ordered", label: "Pedidos enviados" }, { value: "status:partial", label: "Recebimento parcial" }, { value: "status:received", label: "Recebidas" }, { value: "status:cancelled", label: "Canceladas" }],
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialQuery(): ReportQuery {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 86_400_000);
  return { type: "sales", dateFrom: isoDate(start), dateTo: isoDate(end), comparePrevious: true, filters: {} };
}

function metricValue(value: number, format: Exclude<ReportValueFormat, "text" | "date">) {
  if (format === "money") return formatMoney(value);
  if (format === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value);
}

function tableValue(value: string | number, format: ReportValueFormat) {
  if (typeof value !== "number") return value || "—";
  if (format === "money") return formatMoney(value);
  if (format === "percent") return `${value.toFixed(1)}%`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

export function ReportsAdmin() {
  const { data, currentUser, saveReport, deleteReport, recordExportRun } = useAdminData();
  const confirm = useConfirm();
  const [tab, setTab] = useState<ReportTab>("builder");
  const [query, setQuery] = useState<ReportQuery>(initialQuery);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [reportName, setReportName] = useState("");
  const [shared, setShared] = useState(false);
  const [message, setMessage] = useState("");
  const result = useMemo(() => buildReport(data, query), [data, query]);
  const maxSeries = Math.max(1, ...result.series.map((item) => Math.abs(item.value)));
  const selectedReport = data.savedReports.find((item) => item.id === selectedReportId);

  function setPeriod(days: number) {
    const end = new Date();
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    setQuery((current) => ({ ...current, dateFrom: isoDate(start), dateTo: isoDate(end) }));
    setSelectedReportId("");
  }

  function loadReport(report: SavedReport) {
    setQuery({ type: report.type, dateFrom: report.dateFrom, dateTo: report.dateTo, comparePrevious: report.comparePrevious, filters: report.filters });
    setSelectedReportId(report.id);
    setReportName(report.name);
    setShared(report.shared);
    setTab("builder");
    setMessage(`Relatório “${report.name}” carregado.`);
  }

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    if (reportName.trim().length < 2) { setMessage("Informe um nome para salvar o relatório."); return; }
    const now = new Date().toISOString();
    const report: SavedReport = {
      id: selectedReport?.id ?? crypto.randomUUID(), name: reportName.trim(), type: query.type, dateFrom: query.dateFrom, dateTo: query.dateTo,
      comparePrevious: query.comparePrevious, filters: query.filters, shared, createdBy: selectedReport?.createdBy || currentUser.email,
      createdAt: selectedReport?.createdAt || now, updatedAt: now,
    };
    const parsed = savedReportSchema.safeParse(report);
    if (!parsed.success) { setMessage(parsed.error.issues[0]?.message || "Revise os dados do relatório."); return; }
    await saveReport(parsed.data);
    setSelectedReportId(report.id);
    setSaveOpen(false);
    setMessage("Relatório salvo e disponível para a equipe autorizada.");
  }

  async function exportReport(format: ReportFormat) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const name = selectedReport?.name || reportTypeLabels[query.type];
    try {
      const fileName = downloadReportFile(result, format, name);
      const run: ExportRun = { id, reportId: selectedReportId, reportName: name, format, rowCount: result.rows.length, status: "completed", fileName, errorMessage: "", actorEmail: currentUser.email, createdAt };
      await recordExportRun(run);
      setMessage(`${fileName} foi gerado com sucesso.`);
    } catch (caught) {
      const errorMessage = caught instanceof Error ? caught.message : "Falha ao gerar o arquivo.";
      await recordExportRun({ id, reportId: selectedReportId, reportName: name, format, rowCount: result.rows.length, status: "failed", fileName: "", errorMessage, actorEmail: currentUser.email, createdAt });
      setMessage(errorMessage);
    }
  }

  return <div className="reports-page">
    <section className="reports-hero">
      <div><span><Sparkles /> INTELIGÊNCIA OPERACIONAL</span><h2>Decisões melhores, sem depender de planilhas paralelas.</h2><p>Compare períodos, encontre rupturas antes que aconteçam e exporte informações confiáveis para conferência.</p></div>
      <aside><LineChart /><strong>{data.savedReports.length}</strong><span>relatórios salvos</span><small>{data.exportRuns.length} exportações registradas</small></aside>
    </section>

    <nav className="reports-tabs" aria-label="Áreas da central de relatórios">
      <button className={tab === "builder" ? "active" : ""} onClick={() => setTab("builder")}><BarChart3 /> Analisar</button>
      <button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}><Save /> Relatórios salvos <span>{data.savedReports.length}</span></button>
      <button className={tab === "exports" ? "active" : ""} onClick={() => setTab("exports")}><FileClock /> Exportações <span>{data.exportRuns.length}</span></button>
    </nav>

    {message && <div className="reports-status" role="status"><Check /> {message}<button onClick={() => setMessage("")}>×</button></div>}

    {tab === "builder" && <>
      <section className="report-controls">
        <label><span>Relatório</span><select value={query.type} onChange={(event) => { setQuery((current) => ({ ...current, type: event.target.value as ReportType, filters: {} })); setSelectedReportId(""); }}>{Object.entries(reportTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span>Filtro principal</span><select value={query.filters.primary || "all"} onChange={(event) => { setQuery((current) => ({ ...current, filters: event.target.value === "all" ? {} : { ...current.filters, primary: event.target.value } })); setSelectedReportId(""); }}>{reportFilterOptions[query.type].map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select></label>
        <div className="report-period-shortcuts"><span>Período rápido</span><div><button onClick={() => setPeriod(7)}>7 dias</button><button onClick={() => setPeriod(30)}>30 dias</button><button onClick={() => setPeriod(90)}>90 dias</button></div></div>
        <label><span>De</span><input type="date" value={query.dateFrom} max={query.dateTo} onChange={(event) => { setQuery((current) => ({ ...current, dateFrom: event.target.value })); setSelectedReportId(""); }} /></label>
        <label><span>Até</span><input type="date" value={query.dateTo} min={query.dateFrom} onChange={(event) => { setQuery((current) => ({ ...current, dateTo: event.target.value })); setSelectedReportId(""); }} /></label>
        <label className="report-compare"><input type="checkbox" checked={query.comparePrevious} onChange={(event) => setQuery((current) => ({ ...current, comparePrevious: event.target.checked }))} /><span>Comparar ao período anterior</span></label>
      </section>

      <section className="report-actions-bar"><div><CalendarRange /><span>{result.periodLabel}</span>{query.filters.primary && <strong>{reportFilterOptions[query.type].find((option) => option.value === query.filters.primary)?.label}</strong>}{selectedReport && <strong><Save /> {selectedReport.name}</strong>}</div><div><button onClick={() => { setReportName(selectedReport?.name || result.title); setShared(selectedReport?.shared ?? false); setSaveOpen(true); }}><Save /> {selectedReport ? "Atualizar" : "Salvar"}</button><button onClick={() => void exportReport("csv")}><FileText /> CSV</button><button onClick={() => void exportReport("xlsx")}><FileSpreadsheet /> Excel</button><button onClick={() => void exportReport("pdf")}><Download /> PDF</button></div></section>

      {saveOpen && <form className="report-save-card" onSubmit={submitReport}><div><Save /><span><strong>Salvar configuração</strong><small>Período, tipo e comparação poderão ser reabertos depois.</small></span></div><label>Nome<input autoFocus value={reportName} onChange={(event) => setReportName(event.target.value)} /></label><label className="report-share"><input type="checkbox" checked={shared} onChange={(event) => setShared(event.target.checked)} /><Share2 /> Compartilhar com usuários que possuem acesso a relatórios</label><div><button type="button" onClick={() => setSaveOpen(false)}>Cancelar</button><button className="primary"><Save /> Salvar relatório</button></div></form>}

      <section className="report-metrics">{result.metrics.map((metric) => { const comparison = result.comparison[metric.key]; const positive = comparison?.changePercent !== null && (comparison?.changePercent ?? 0) >= 0; return <article key={metric.key}><span>{metric.label}</span><strong>{metricValue(metric.value, metric.format)}</strong>{comparison && <small className={positive ? "up" : "down"}>{positive ? <TrendingUp /> : <TrendingDown />}{comparison.changePercent === null ? "Sem base anterior" : `${Math.abs(comparison.changePercent).toFixed(1)}% vs. anterior`}</small>}</article>; })}</section>

      <div className="report-visual-grid">
        <section className="report-chart"><header><div><strong>Evolução do período</strong><span>{result.series.length ? `${result.series.length} pontos consolidados` : "Sem movimento no período"}</span></div><BarChart3 /></header>{result.series.length ? <div className="report-bars">{result.series.slice(-16).map((item) => <div key={item.label} title={`${item.label}: ${item.value.toFixed(2)}`}><i style={{ height: `${Math.max(6, Math.abs(item.value) / maxSeries * 100)}%` }} className={item.value < 0 ? "negative" : ""} /><span>{item.label}</span></div>)}</div> : <AdminEmpty><BarChart3 /><strong>Nenhum dado para o gráfico.</strong><span>Amplie o período ou escolha outro relatório.</span></AdminEmpty>}</section>
        <section className="report-confidence"><header><LockKeyhole /><div><strong>Dados rastreáveis</strong><span>Fonte operacional do painel</span></div></header><ul><li><Check /> Período explícito no arquivo</li><li><Check /> Filtros preservados na configuração</li><li><Check /> Exportação registrada por usuário</li><li><Check /> Sem credenciais ou dados de autenticação</li></ul></section>
      </div>

      <section className="report-table-card"><header><div><strong>{result.title}</strong><span>{result.rows.length} linha{result.rows.length === 1 ? "" : "s"} no resultado</span></div><small>Role horizontalmente para conferir todas as colunas.</small></header><div className="admin-table-wrap"><table className="admin-table report-table"><thead><tr>{result.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={`${index}-${String(row[result.columns[0]?.key] ?? "row")}`}>{result.columns.map((column) => <td key={column.key}>{tableValue(row[column.key] ?? "", column.format)}</td>)}</tr>)}{!result.rows.length && <tr><td colSpan={result.columns.length}><AdminEmpty><FileText /><strong>Nenhum registro no período.</strong><span>O relatório continua disponível para exportação com os cabeçalhos.</span></AdminEmpty></td></tr>}</tbody></table></div></section>
    </>}

    {tab === "saved" && <section className="saved-reports-grid">{data.savedReports.map((report) => <article key={report.id}><header><span className={report.type}><BarChart3 /></span><div><strong>{report.name}</strong><small>{reportTypeLabels[report.type]}</small></div>{report.shared ? <em><Users /> Equipe</em> : <em><LockKeyhole /> Privado</em>}</header><dl><div><dt>Período</dt><dd>{report.dateFrom} a {report.dateTo}</dd></div><div><dt>Comparação</dt><dd>{report.comparePrevious ? "Ativa" : "Desativada"}</dd></div><div><dt>Atualizado</dt><dd>{formatDateTime(report.updatedAt)}</dd></div></dl><footer><button onClick={() => loadReport(report)}><LineChart /> Abrir relatório</button><button aria-label={`Excluir ${report.name}`} onClick={async () => { const accepted = await confirm({ title: "Excluir relatório salvo?", description: `A configuração “${report.name}” será removida. O histórico de exportações será preservado.`, confirmLabel: "Excluir relatório", danger: true }); if (accepted) await deleteReport(report.id); }}><Trash2 /></button></footer></article>)}{!data.savedReports.length && <AdminEmpty><Save /><strong>Nenhum relatório salvo.</strong><span>Monte uma análise e salve a configuração para reutilizá-la.</span><button className="admin-button primary" onClick={() => setTab("builder")}><Plus /> Criar relatório</button></AdminEmpty>}</section>}

    {tab === "exports" && <section className="export-history"><header><div><History /><span><strong>Histórico de exportações</strong><small>Rastreabilidade de arquivos gerados no painel.</small></span></div><em>{data.exportRuns.length} registro{data.exportRuns.length === 1 ? "" : "s"}</em></header><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Arquivo</th><th>Relatório</th><th>Formato</th><th>Linhas</th><th>Usuário</th><th>Data</th><th>Status</th></tr></thead><tbody>{data.exportRuns.map((run) => <tr key={run.id}><td><strong>{run.fileName || "Arquivo não gerado"}</strong>{run.errorMessage && <small>{run.errorMessage}</small>}</td><td>{run.reportName}</td><td><span className={`export-format ${run.format}`}>{run.format.toUpperCase()}</span></td><td>{run.rowCount}</td><td>{run.actorEmail || "Equipe"}</td><td>{formatDateTime(run.createdAt)}</td><td><span className={`export-status ${run.status}`}>{run.status === "completed" ? "Concluído" : "Falhou"}</span></td></tr>)}{!data.exportRuns.length && <tr><td colSpan={7}><AdminEmpty><FileClock /><strong>Nenhuma exportação registrada.</strong><span>Gere um CSV, Excel ou PDF para iniciar o histórico.</span></AdminEmpty></td></tr>}</tbody></table></div></section>}
  </div>;
}
