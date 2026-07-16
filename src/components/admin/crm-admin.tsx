"use client";

import { IconCalendarEvent, IconCheck, IconChecklist, IconClock, IconMessageCircle, IconPlus, IconUsersGroup } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { buildCustomerInsights } from "@/lib/crm";
import { formatDateTime, formatMoney } from "@/lib/format";
import { tasksDueToday } from "@/lib/operations";
import { customerContactSchema, customerTaskSchema } from "@/lib/validation";
import type { CustomerContact, CustomerTask, CustomerTaskPriority } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel } from "./admin-ui";

const priorityLabels: Record<CustomerTaskPriority, string> = { low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente" };
const channelLabels: Record<CustomerContact["channel"], string> = { whatsapp: "WhatsApp", phone: "Telefone", instagram: "Instagram", email: "E-mail", other: "Outro" };
const resultLabels: Record<CustomerContact["result"], string> = { answered: "Respondido", no_answer: "Sem resposta", sale: "Gerou venda", follow_up: "Novo retorno", opt_out: "Não deseja contato" };

export function CrmAdmin() {
  const { data, currentUser, saveCustomer, saveCustomerContact, saveCustomerTask, deleteCustomerTask } = useAdminData();
  const [view, setView] = useState<"today" | "tasks" | "contacts">("today");
  const [taskOpen, setTaskOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [error, setError] = useState("");
  const insights = useMemo(() => buildCustomerInsights(data.customers, data.orders), [data.customers, data.orders]);
  const dueTasks = useMemo(() => tasksDueToday(data.customerTasks), [data.customerTasks]);
  const openTasks = data.customerTasks.filter((task) => task.status === "open");
  const customersAtRisk = insights.filter((customer) => ["at_risk", "inactive"].includes(customer.segment));
  const completed = data.customerTasks.filter((task) => task.status === "completed").length;
  const completionRate = data.customerTasks.length ? completed / data.customerTasks.length * 100 : 0;

  const [task, setTask] = useState<CustomerTask>(() => ({ id: crypto.randomUUID(), customerId: "", title: "", dueAt: "", priority: "medium", status: "open", assignedTo: currentUser.email, notes: "", createdAt: new Date().toISOString(), completedAt: "" }));
  const [contact, setContact] = useState<CustomerContact>(() => ({ id: crypto.randomUUID(), customerId: "", channel: "whatsapp", result: "answered", summary: "", nextStepAt: "", actorEmail: currentUser.email, createdAt: new Date().toISOString() }));
  const customerName = (id: string) => insights.find((customer) => customer.id === id)?.name ?? "Cliente não identificado";

  async function submitTask(event: React.FormEvent) {
    event.preventDefault();
    const parsed = customerTaskSchema.safeParse(task);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise a tarefa."); return; }
    await saveCustomerTask(task);
    setTask({ id: crypto.randomUUID(), customerId: "", title: "", dueAt: "", priority: "medium", status: "open", assignedTo: currentUser.email, notes: "", createdAt: new Date().toISOString(), completedAt: "" });
    setTaskOpen(false); setError("");
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    const parsed = customerContactSchema.safeParse(contact);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise o contato."); return; }
    await saveCustomerContact(contact);
    if (contact.result === "opt_out") {
      const customer = data.customers.find((item) => item.id === contact.customerId);
      if (customer) await saveCustomer({ ...customer, whatsappConsent: false, emailConsent: false, updatedAt: new Date().toISOString() });
    }
    if (contact.nextStepAt) {
      await saveCustomerTask({ id: crypto.randomUUID(), customerId: contact.customerId, title: "Retorno após contato", dueAt: contact.nextStepAt, priority: "medium", status: "open", assignedTo: currentUser.email, notes: contact.summary, createdAt: new Date().toISOString(), completedAt: "" });
    }
    setContact({ id: crypto.randomUUID(), customerId: "", channel: "whatsapp", result: "answered", summary: "", nextStepAt: "", actorEmail: currentUser.email, createdAt: new Date().toISOString() });
    setContactOpen(false); setError("");
  }

  return <div className="ops-page">
    <section className="ops-hero"><div><span>CRM OPERACIONAL</span><h2>Relacionamento que vira próxima ação.</h2><p>Organize retornos, registre conversas e acompanhe oportunidades sem depender da memória da equipe.</p></div><div className="ops-hero-actions"><button className="admin-button" onClick={() => { setContactOpen(true); setTaskOpen(false); }}><IconMessageCircle /> Registrar contato</button><button className="admin-button primary" onClick={() => { setTaskOpen(true); setContactOpen(false); }}><IconPlus /> Nova tarefa</button></div></section>

    <section className="ops-metric-grid" aria-label="Indicadores do CRM">
      <article><span className="blue"><IconUsersGroup /></span><div><small>Clientes</small><strong>{insights.length}</strong><p>{customersAtRisk.length} precisam de atenção</p></div></article>
      <article><span className="warning"><IconCalendarEvent /></span><div><small>Para fazer hoje</small><strong>{dueTasks.length}</strong><p>tarefas vencidas ou do dia</p></div></article>
      <article><span className="purple"><IconChecklist /></span><div><small>Em aberto</small><strong>{openTasks.length}</strong><p>próximos passos registrados</p></div></article>
      <article><span className="green"><IconCheck /></span><div><small>Conclusão</small><strong>{completionRate.toFixed(0)}%</strong><p>{completed} tarefas concluídas</p></div></article>
    </section>

    {(taskOpen || contactOpen) && <AdminPanel title={taskOpen ? "Nova tarefa" : "Registrar atendimento"} description={taskOpen ? "Defina quem precisa de contato, quando e por qual motivo." : "Salve o que aconteceu e já programe o próximo passo."}>
      {taskOpen ? <form className="ops-form" onSubmit={submitTask}>
        <label>Cliente<select value={task.customerId} onChange={(event) => setTask((current) => ({ ...current, customerId: event.target.value }))}><option value="">Selecione</option>{insights.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
        <label>Prioridade<select value={task.priority} onChange={(event) => setTask((current) => ({ ...current, priority: event.target.value as CustomerTaskPriority }))}>{Object.entries(priorityLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="wide">Tarefa<input value={task.title} onChange={(event) => setTask((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: confirmar recompra" /></label>
        <label>Prazo<input type="datetime-local" value={task.dueAt.slice(0, 16)} onChange={(event) => setTask((current) => ({ ...current, dueAt: event.target.value }))} /></label>
        <label>Responsável<input value={task.assignedTo} onChange={(event) => setTask((current) => ({ ...current, assignedTo: event.target.value }))} /></label>
        <label className="wide">Observações<textarea rows={3} value={task.notes} onChange={(event) => setTask((current) => ({ ...current, notes: event.target.value }))} /></label>
        {error && <p className="admin-form-error wide" role="alert">{error}</p>}
        <div className="ops-form-actions wide"><button type="button" className="admin-button" onClick={() => setTaskOpen(false)}>Cancelar</button><button className="admin-button primary">Salvar tarefa</button></div>
      </form> : <form className="ops-form" onSubmit={submitContact}>
        <label>Cliente<select value={contact.customerId} onChange={(event) => setContact((current) => ({ ...current, customerId: event.target.value }))}><option value="">Selecione</option>{insights.map((customer) => <option value={customer.id} key={customer.id}>{customer.name}</option>)}</select></label>
        <label>Canal<select value={contact.channel} onChange={(event) => setContact((current) => ({ ...current, channel: event.target.value as CustomerContact["channel"] }))}>{Object.entries(channelLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Resultado<select value={contact.result} onChange={(event) => setContact((current) => ({ ...current, result: event.target.value as CustomerContact["result"] }))}>{Object.entries(resultLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Próximo retorno<input type="datetime-local" value={contact.nextStepAt.slice(0, 16)} onChange={(event) => setContact((current) => ({ ...current, nextStepAt: event.target.value }))} /></label>
        <label className="wide">Resumo<input value={contact.summary} onChange={(event) => setContact((current) => ({ ...current, summary: event.target.value }))} placeholder="O que foi conversado e qual foi o resultado?" /></label>
        {error && <p className="admin-form-error wide" role="alert">{error}</p>}
        <div className="ops-form-actions wide"><button type="button" className="admin-button" onClick={() => setContactOpen(false)}>Cancelar</button><button className="admin-button primary">Salvar na timeline</button></div>
      </form>}
    </AdminPanel>}

    <div className="ops-tabs" role="tablist"><button className={view === "today" ? "active" : ""} onClick={() => setView("today")}>Hoje <b>{dueTasks.length}</b></button><button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>Todas as tarefas <b>{openTasks.length}</b></button><button className={view === "contacts" ? "active" : ""} onClick={() => setView("contacts")}>Timeline <b>{data.customerContacts.length}</b></button><Link href="/admin/customers">Abrir clientes 360 →</Link></div>

    <AdminPanel title={view === "contacts" ? "Atendimentos recentes" : view === "today" ? "Prioridades de hoje" : "Tarefas do CRM"} description="Cada item tem responsável, prazo e histórico auditável.">
      {view === "contacts" ? <div className="ops-timeline">{data.customerContacts.map((item) => <article key={item.id}><span><IconMessageCircle /></span><div><strong>{customerName(item.customerId)}</strong><p>{item.summary}</p><small>{channelLabels[item.channel]} · {resultLabels[item.result]} · {formatDateTime(item.createdAt)}</small></div>{item.nextStepAt && <time>Retorno {formatDateTime(item.nextStepAt)}</time>}</article>)}{!data.customerContacts.length && <AdminEmpty><IconMessageCircle /><strong>Nenhum atendimento registrado.</strong><span>Registre o primeiro contato para iniciar a timeline.</span></AdminEmpty>}</div> : <div className="ops-task-list">{(view === "today" ? dueTasks : data.customerTasks).map((item) => <article key={item.id} className={item.status}><span className={`priority ${item.priority}`}>{priorityLabels[item.priority]}</span><div><strong>{item.title}</strong><p>{customerName(item.customerId)} · {item.assignedTo}</p><small><IconClock /> {item.dueAt ? formatDateTime(item.dueAt) : "Sem prazo"}{item.notes ? ` · ${item.notes}` : ""}</small></div><div className="ops-row-actions">{item.status === "open" && <button className="admin-button primary" onClick={() => void saveCustomerTask({ ...item, status: "completed", completedAt: new Date().toISOString() })}><IconCheck /> Concluir</button>}<button className="admin-button" onClick={() => void deleteCustomerTask(item.id)}>Excluir</button></div></article>)}{!(view === "today" ? dueTasks : data.customerTasks).length && <AdminEmpty><IconChecklist /><strong>Nenhuma tarefa nesta visão.</strong><span>Crie um próximo passo para não perder oportunidades.</span></AdminEmpty>}</div>}
    </AdminPanel>

    <section className="ops-customer-opportunities"><header><div><h3>Oportunidades de relacionamento</h3><p>Clientes em risco, inativos ou com maior valor acumulado.</p></div><Link className="admin-button" href="/admin/customers">Ver todos</Link></header><div>{insights.slice().sort((a, b) => Number(["at_risk", "inactive"].includes(b.segment)) - Number(["at_risk", "inactive"].includes(a.segment)) || b.totalSpent - a.totalSpent).slice(0, 5).map((customer) => <article key={customer.id}><div><strong>{customer.name}</strong><small>{customer.orderCount} pedidos · última compra {customer.lastOrderAt ? formatDateTime(customer.lastOrderAt) : "não registrada"}</small></div><span>{formatMoney(customer.totalSpent)}</span></article>)}</div></section>
  </div>;
}
