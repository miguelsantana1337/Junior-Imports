"use client";

import { Activity, AlertTriangle, ArrowRight, Bot, CheckCircle2, CirclePause, Clock3, Eye, Mail, MessageCircle, Pencil, Play, Plus, RefreshCw, Route, Save, Send, Sparkles, Trash2, Workflow, X, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatDateTime } from "@/lib/format";
import { simulateMessageAutomation } from "@/lib/marketing";
import { messageAutomationSchema } from "@/lib/validation";
import type { AutomationRun, AutomationTriggerType, CustomerSegment, MessageAutomation, OrderStatus } from "@/types/store";
import { useAdminData } from "./admin-data-provider";

const orderStatuses: OrderStatus[] = ["Novo", "Aguardando pagamento", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"];
const segmentLabels: Record<CustomerSegment, string> = { new: "Novo", active: "Ativo", recurring: "Recorrente", vip: "VIP", at_risk: "Em risco", inactive: "Inativo" };
const triggerLabels: Record<AutomationTriggerType, string> = { order_status: "Status do pedido", customer_segment: "Entrada em segmento", cashback_expiring: "Cashback vencendo", schedule: "Data programada" };
const runStatusLabels: Record<AutomationRun["status"], string> = { testing: "Testando", simulated: "Simulada", queued: "Na fila", running: "Executando", succeeded: "Concluída", failed: "Falhou", retrying: "Novo envio", cancelled: "Cancelada" };

function newAutomation(order: number): MessageAutomation {
  return { id: crypto.randomUUID(), name: "Nova automação", triggerType: "order_status", triggerValue: "Novo", triggerStatus: "Novo", channel: "whatsapp", subject: "", message: "Olá, {{cliente}}! O pedido {{pedido}} agora está com o status {{status}}.", conditions: { minOrderTotal: 0, orderSource: "any", customerSegment: "all" }, actions: { sendMessage: true, createTask: false, taskTitle: "", addTag: "" }, status: "draft", maxRetries: 3, retryDelayMinutes: 15, lastTestedAt: "", runCount: 0, failureCount: 0, active: false, order };
}

export function AutomationStudio() {
  const { data, saveMessageAutomation, deleteMessageAutomation, retryAutomationRun } = useAdminData();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<MessageAutomation | null>(null);
  const automations = useMemo(() => [...data.messageAutomations].sort((a, b) => a.order - b.order), [data.messageAutomations]);
  useEffect(() => { if (searchParams.get("novo") === "1") setEditing(newAutomation(automations.length + 1)); }, [automations.length, searchParams]);

  return <section className="automation-studio-shell">
    <header className="marketing-section-header"><div><span>AUTOMAÇÕES</span><h2>Construa rotinas como blocos de software</h2><p>Defina o gatilho, refine as condições, escolha ações e simule antes de ativar.</p></div><button className="admin-button primary" onClick={() => setEditing(newAutomation(automations.length + 1))}><Plus /> Nova automação</button></header>
    <div className="automation-reliability-note"><Sparkles /><div><strong>Modo seguro de comunicação</strong><span>Os fluxos são executados e auditados, mas WhatsApp e e-mail permanecem simulados até a conexão de um provedor externo.</span></div></div>
    <div className="automation-rule-list">{automations.map((automation) => <article key={automation.id} className={automation.status}>
      <header><span className={`automation-state ${automation.status}`}>{automation.status === "active" ? <Zap /> : automation.status === "paused" ? <CirclePause /> : <Pencil />} {automation.status === "active" ? "Ativa" : automation.status === "paused" ? "Pausada" : "Rascunho"}</span><div><button title={automation.status === "active" ? "Pausar" : "Ativar"} onClick={() => { void saveMessageAutomation({ ...automation, status: automation.status === "active" ? "paused" : "active", active: automation.status !== "active" }); }}>{automation.status === "active" ? <CirclePause /> : <Play />}</button><button title="Editar" onClick={() => setEditing(automation)}><Pencil /></button><button className="danger" title="Excluir" onClick={async () => { const accepted = await confirm({ title: "Excluir automação?", description: `A regra “${automation.name}” será removida. Os logs históricos serão preservados.`, confirmLabel: "Excluir automação", danger: true }); if (accepted) await deleteMessageAutomation(automation.id); }}><Trash2 /></button></div></header>
      <h3>{automation.name}</h3>
      <div className="automation-flow-line"><span><Route /> {triggerLabels[automation.triggerType]}<b>{automation.triggerValue}</b></span><ArrowRight /><span><Workflow /> Condições<b>{automation.conditions.minOrderTotal > 0 ? `Pedido ≥ R$ ${automation.conditions.minOrderTotal}` : "Sem valor mínimo"}</b></span><ArrowRight /><span><Send /> Ações<b>{[automation.actions.sendMessage ? "Mensagem" : "", automation.actions.createTask ? "Tarefa" : "", automation.actions.addTag ? "Etiqueta" : ""].filter(Boolean).join(" + ")}</b></span></div>
      <footer><span>{automation.channel === "whatsapp" ? <MessageCircle /> : <Mail />} {automation.channel === "whatsapp" ? "WhatsApp" : "E-mail"}</span><span><RefreshCw /> {automation.maxRetries} retries · {automation.retryDelayMinutes} min</span><span><Activity /> {automation.runCount} execuções · {automation.failureCount} falhas</span>{automation.lastTestedAt && <span><CheckCircle2 /> Testada {formatDateTime(automation.lastTestedAt)}</span>}</footer>
    </article>)}</div>
    {!automations.length && <div className="automation-empty"><Bot /><strong>Nenhuma automação configurada.</strong><span>Crie um fluxo e simule com um pedido real antes de ativar.</span></div>}
    <AutomationRuns runs={data.automationRuns} onRetry={retryAutomationRun} />
    {editing && <AutomationBuilder automation={editing} onClose={() => setEditing(null)} />}
  </section>;
}

function AutomationRuns({ runs, onRetry }: { runs: AutomationRun[]; onRetry: (id: string) => Promise<void> }) {
  return <section className="automation-runs-panel"><header><div><Activity /><span><strong>Execuções recentes</strong><small>Teste, resultado, tentativas e motivo de falha</small></span></div><b>{runs.length}</b></header><div className="automation-runs-table"><table><thead><tr><th>Execução</th><th>Automação</th><th>Gatilho</th><th>Status</th><th>Tentativa</th><th>Horário</th><th /></tr></thead><tbody>{runs.slice(0, 20).map((run) => <tr key={run.id}><td><code>{run.id.slice(0, 8)}</code></td><td><strong>{run.automationName}</strong>{run.errorMessage && <small>{run.errorMessage}</small>}</td><td>{triggerLabels[run.triggerType]}</td><td><span className={`automation-run-status ${run.status}`}>{run.status === "failed" ? <AlertTriangle /> : <CheckCircle2 />}{runStatusLabels[run.status]}</span></td><td>{run.attempt} / {run.maxAttempts}</td><td>{formatDateTime(run.createdAt)}</td><td>{["failed", "retrying"].includes(run.status) && run.attempt < run.maxAttempts && <button className="admin-button" onClick={() => { void onRetry(run.id); }}><RefreshCw /> Reenviar</button>}</td></tr>)}{!runs.length && <tr><td colSpan={7}><div className="automation-run-empty"><Clock3 /><span>Nenhuma execução registrada.</span></div></td></tr>}</tbody></table></div></section>;
}

function AutomationBuilder({ automation, onClose }: { automation: MessageAutomation; onClose: () => void }) {
  const { data, saveMessageAutomation, testMessageAutomation } = useAdminData();
  const [form, setForm] = useState(automation);
  const [testOrderId, setTestOrderId] = useState(data.orders[0]?.id ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const testOrder = data.orders.find((item) => item.id === testOrderId);
  const preview = testOrder ? simulateMessageAutomation(form, testOrder) : null;
  const field = <K extends keyof MessageAutomation>(key: K, value: MessageAutomation[K]) => setForm((current) => ({ ...current, [key]: value }));
  const condition = <K extends keyof MessageAutomation["conditions"]>(key: K, value: MessageAutomation["conditions"][K]) => setForm((current) => ({ ...current, conditions: { ...current.conditions, [key]: value } }));
  const action = <K extends keyof MessageAutomation["actions"]>(key: K, value: MessageAutomation["actions"][K]) => setForm((current) => ({ ...current, actions: { ...current.actions, [key]: value } }));

  function triggerInput() {
    if (form.triggerType === "order_status") return <select value={form.triggerValue} onChange={(event) => { field("triggerValue", event.target.value); field("triggerStatus", event.target.value as OrderStatus); }}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select>;
    if (form.triggerType === "customer_segment") return <select value={form.triggerValue} onChange={(event) => field("triggerValue", event.target.value)}>{Object.entries(segmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>;
    if (form.triggerType === "cashback_expiring") return <select value={form.triggerValue} onChange={(event) => field("triggerValue", event.target.value)}><option value="7">7 dias antes</option><option value="15">15 dias antes</option><option value="30">30 dias antes</option></select>;
    return <input type="datetime-local" value={form.triggerValue.slice(0, 16)} onChange={(event) => field("triggerValue", event.target.value)} />;
  }

  async function persistAndMaybeTest(test: boolean) {
    const candidate = { ...form, active: form.status === "active" };
    const parsed = messageAutomationSchema.safeParse(candidate);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise a automação."); return; }
    if (test && !testOrderId) { setError("Selecione um pedido para simular."); return; }
    setSaving(true); setError("");
    try { await saveMessageAutomation({ ...parsed.data, id: form.id }); if (test) await testMessageAutomation(form.id, testOrderId); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar a automação."); } finally { setSaving(false); }
  }

  return createPortal(<div className="admin-modal automation-builder-modal" role="dialog" aria-modal="true" aria-label={`Construtor ${form.name}`}><button className="admin-modal-overlay" aria-label="Fechar" onClick={onClose} /><div className="automation-builder-panel"><header><div><span>AUTOMATION BUILDER</span><h2>{form.name}</h2><p>Configure o fluxo em quatro passos e valide o resultado antes de ativar.</p></div><button aria-label="Fechar" onClick={onClose}><X /></button></header>
    <div className="automation-builder-layout"><form onSubmit={(event) => { event.preventDefault(); void persistAndMaybeTest(false); }}>
      <section><header><b>1</b><div><strong>Quando isto acontecer</strong><span>Escolha o evento que inicia o fluxo.</span></div></header><div className="automation-builder-grid"><label className="full">Nome<input value={form.name} onChange={(event) => field("name", event.target.value)} autoFocus /></label><label>Gatilho<select value={form.triggerType} onChange={(event) => { const type = event.target.value as AutomationTriggerType; field("triggerType", type); field("triggerValue", type === "order_status" ? "Novo" : type === "customer_segment" ? "vip" : type === "cashback_expiring" ? "7" : new Date().toISOString()); }}>{Object.entries(triggerLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Evento{triggerInput()}</label></div></section>
      <section><header><b>2</b><div><strong>Somente se</strong><span>Refine o público e reduza disparos indevidos.</span></div></header><div className="automation-builder-grid"><label>Valor mínimo<input type="number" min="0" step="0.01" value={form.conditions.minOrderTotal} onChange={(event) => condition("minOrderTotal", Number(event.target.value))} /></label><label>Origem<select value={form.conditions.orderSource} onChange={(event) => condition("orderSource", event.target.value as MessageAutomation["conditions"]["orderSource"])}><option value="any">Qualquer origem</option><option value="storefront">Loja</option><option value="admin">Painel</option><option value="legacy">Legado</option></select></label><label className="full">Segmento<select value={form.conditions.customerSegment} onChange={(event) => condition("customerSegment", event.target.value as MessageAutomation["conditions"]["customerSegment"])}><option value="all">Todos os clientes</option>{Object.entries(segmentLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div></section>
      <section><header><b>3</b><div><strong>Faça isto</strong><span>Combine comunicação, tarefa e etiqueta.</span></div></header><div className="automation-action-toggles"><label><input type="checkbox" checked={form.actions.sendMessage} onChange={(event) => action("sendMessage", event.target.checked)} /><span><Send /><strong>Gerar mensagem</strong><small>Simulada até conectar provedor</small></span></label><label><input type="checkbox" checked={form.actions.createTask} onChange={(event) => action("createTask", event.target.checked)} /><span><CheckCircle2 /><strong>Criar tarefa</strong><small>Adiciona ao CRM</small></span></label><label><input type="checkbox" checked={Boolean(form.actions.addTag)} onChange={(event) => action("addTag", event.target.checked ? "automação" : "")} /><span><Sparkles /><strong>Adicionar etiqueta</strong><small>Atualiza o cliente</small></span></label></div><div className="automation-builder-grid">{form.actions.sendMessage && <><label>Canal<select value={form.channel} onChange={(event) => field("channel", event.target.value as MessageAutomation["channel"])}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></select></label>{form.channel === "email" && <label>Assunto<input value={form.subject} onChange={(event) => field("subject", event.target.value)} /></label>}<label className="full">Mensagem<textarea rows={5} value={form.message} onChange={(event) => field("message", event.target.value)} /></label></>}{form.actions.createTask && <label className="full">Título da tarefa<input value={form.actions.taskTitle} onChange={(event) => action("taskTitle", event.target.value)} /></label>}{form.actions.addTag && <label className="full">Etiqueta<input value={form.actions.addTag} onChange={(event) => action("addTag", event.target.value)} /></label>}<div className="message-placeholders full"><code>{"{{cliente}}"}</code><code>{"{{pedido}}"}</code><code>{"{{status}}"}</code><code>{"{{total}}"}</code></div></div></section>
      <section><header><b>4</b><div><strong>Confiabilidade</strong><span>Controle status, tentativas e intervalo de retry.</span></div></header><div className="automation-builder-grid"><label>Status<select value={form.status} onChange={(event) => field("status", event.target.value as MessageAutomation["status"])}><option value="draft">Rascunho</option><option value="active">Ativa</option><option value="paused">Pausada</option></select></label><label>Tentativas<input type="number" min="0" max="10" value={form.maxRetries} onChange={(event) => field("maxRetries", Number(event.target.value))} /></label><label>Intervalo em minutos<input type="number" min="1" value={form.retryDelayMinutes} onChange={(event) => field("retryDelayMinutes", Number(event.target.value))} /></label></div></section>
      {error && <p className="admin-form-error" role="alert">{error}</p>}
      <footer><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button type="button" className="admin-button" disabled={saving} onClick={() => { void persistAndMaybeTest(true); }}><Play /> Salvar e simular</button><button className="admin-button primary" disabled={saving}><Save /> {saving ? "Salvando..." : "Salvar automação"}</button></footer>
    </form><aside><header><Eye /><div><strong>Teste seguro</strong><span>Nenhuma mensagem real será enviada.</span></div></header><label>Pedido de exemplo<select value={testOrderId} onChange={(event) => setTestOrderId(event.target.value)}><option value="">Selecione</option>{data.orders.map((order) => <option value={order.id} key={order.id}>{order.code} · {order.customer.name}</option>)}</select></label>{preview ? <div className={`automation-preview ${form.channel}`}><header>{form.channel === "whatsapp" ? <MessageCircle /> : <Mail />}<span>{form.channel === "whatsapp" ? "WhatsApp" : "E-mail"}<small>{preview.recipient || "Sem destinatário"}</small></span></header>{preview.subject && <strong>{preview.subject}</strong>}<p>{preview.message}</p></div> : <div className="automation-preview-empty"><Bot /><span>Selecione um pedido para visualizar a mensagem.</span></div>}<div className="automation-test-checklist"><span><CheckCircle2 /> Placeholders renderizados</span><span><CheckCircle2 /> Condições verificáveis</span><span><CheckCircle2 /> Execução registrada em log</span><span><RefreshCw /> Retry limitado a {form.maxRetries} tentativas</span></div></aside></div>
  </div></div>, document.body);
}
