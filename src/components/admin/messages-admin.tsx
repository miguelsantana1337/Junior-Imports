"use client";

import { Bot, Eye, EyeOff, Mail, MessageCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/format";
import { messageAutomationSchema } from "@/lib/validation";
import type { MessageAutomation, OrderStatus } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";

const statuses: OrderStatus[] = ["Novo", "Aguardando pagamento", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"];

export function MessagesAdmin() {
  const { data, saveMessageAutomation, deleteMessageAutomation } = useAdminData();
  const searchParams = useSearchParams();
  const [editing, setEditing] = useState<MessageAutomation | "new" | null>(null);
  const automations = useMemo(() => [...data.messageAutomations].sort((a, b) => a.order - b.order), [data.messageAutomations]);

  useEffect(() => {
    if (searchParams.get("novo") === "1") setEditing("new");
  }, [searchParams]);

  return <>
    <div className="message-automation-note"><Bot /><div><strong>Mensagens automáticas demonstrativas</strong><span>Ao mudar o status de um pedido, o painel registra o disparo com os dados do cliente. Para envio real, conecte posteriormente um provedor de WhatsApp ou e-mail.</span></div></div>
    <div className="message-stats"><article><span>Automações ativas</span><strong>{automations.filter((item) => item.active).length}</strong><small>de {automations.length} configuradas</small></article><article><span>Mensagens registradas</span><strong>{data.messageLogs.length}</strong><small>histórico demonstrativo</small></article><article><span>Canais</span><strong>{new Set(automations.map((item) => item.channel)).size}</strong><small>WhatsApp e e-mail</small></article></div>
    <AdminPanel title="Regras automáticas" description="Escolha o status, o canal e a mensagem enviada ao cliente." action={<button className="admin-button primary" onClick={() => setEditing("new")}><Plus /> Nova automação</button>}>
      <div className="automation-list">{automations.map((automation) => <article key={automation.id}><span className={`automation-channel ${automation.channel}`}>{automation.channel === "whatsapp" ? <MessageCircle /> : <Mail />}</span><div className="sortable-main"><strong>{automation.name}</strong><small>Quando o pedido mudar para <b>{automation.triggerStatus}</b> · {automation.channel === "whatsapp" ? "WhatsApp" : "E-mail"} · <StatusTag active={automation.active}>{automation.active ? "Ativa" : "Pausada"}</StatusTag></small><p>{automation.message}</p></div><div className="admin-actions"><button title={automation.active ? "Pausar" : "Ativar"} onClick={() => saveMessageAutomation({ ...automation, active: !automation.active })}>{automation.active ? <EyeOff /> : <Eye />}</button><button title="Editar" onClick={() => setEditing(automation)}><Pencil /></button><button className="danger" title="Excluir" onClick={() => window.confirm("Excluir esta automação?") && deleteMessageAutomation(automation.id)}><Trash2 /></button></div></article>)}</div>
    </AdminPanel>
    <AdminPanel title="Histórico de mensagens" description="Registro das mensagens geradas pelos pedidos demonstrativos.">
      <div className="admin-table-wrap"><table className="admin-table message-log-table"><thead><tr><th>Data</th><th>Pedido</th><th>Automação</th><th>Canal</th><th>Destinatário</th><th>Status</th></tr></thead><tbody>{data.messageLogs.map((log) => <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td><strong>{log.orderCode}</strong></td><td>{log.automationName}</td><td>{log.channel === "whatsapp" ? "WhatsApp" : "E-mail"}</td><td>{log.recipient}</td><td><StatusTag active={log.status !== "failed"}>{log.status === "simulated" ? "Simulada" : log.status}</StatusTag></td></tr>)}{!data.messageLogs.length && <tr><td colSpan={6}><div className="message-log-empty"><Bot /><strong>Nenhuma mensagem registrada.</strong><span>Atualize o status de um pedido para testar uma automação.</span></div></td></tr>}</tbody></table></div>
    </AdminPanel>
    {editing && <AutomationEditor automation={editing === "new" ? null : editing} count={automations.length} onClose={() => setEditing(null)} />}
  </>;
}

function AutomationEditor({ automation, count, onClose }: { automation: MessageAutomation | null; count: number; onClose: () => void }) {
  const { saveMessageAutomation } = useAdminData();
  const [form, setForm] = useState<MessageAutomation>(automation ?? { id: crypto.randomUUID(), name: "Nova automação", triggerStatus: "Novo", channel: "whatsapp", subject: "", message: "Olá, {{cliente}}! O pedido demonstrativo {{pedido}} agora está com o status {{status}}.", active: true, order: count + 1 });
  const [error, setError] = useState("");
  function field<K extends keyof MessageAutomation>(key: K, value: MessageAutomation[K]) { setForm((current) => ({ ...current, [key]: value })); }
  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="automation-title"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel small"><header><div><span>MENSAGENS</span><h2 id="automation-title">{automation ? "Editar automação" : "Nova automação"}</h2></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><form className="admin-form" onSubmit={async (event) => { event.preventDefault(); const parsed = messageAutomationSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await saveMessageAutomation(form); onClose(); }}><label className="full">Nome da automação<input value={form.name} onChange={(event) => field("name", event.target.value)} /></label><label>Status que dispara<select value={form.triggerStatus} onChange={(event) => field("triggerStatus", event.target.value as OrderStatus)}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>Canal<select value={form.channel} onChange={(event) => field("channel", event.target.value as MessageAutomation["channel"])}><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></select></label>{form.channel === "email" && <label className="full">Assunto<input value={form.subject} onChange={(event) => field("subject", event.target.value)} /></label>}<label className="full">Mensagem<textarea value={form.message} onChange={(event) => field("message", event.target.value)} /></label><div className="message-placeholders full"><strong>Campos disponíveis</strong><code>{"{{cliente}}"}</code><code>{"{{pedido}}"}</code><code>{"{{status}}"}</code><code>{"{{total}}"}</code></div><label className="check-field full"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Automação ativa</label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary">Salvar automação</button></div></form></div></div>;
}
