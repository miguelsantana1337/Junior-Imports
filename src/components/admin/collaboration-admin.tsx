"use client";

import { AtSign, Check, CheckCircle2, CircleDot, Clock3, FileCheck2, Inbox, MessageSquareText, Plus, Radio, Send, ShieldCheck, UserRoundCheck, UsersRound, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime } from "@/lib/format";
import {
  collaborationEntityLabels,
  mapApprovalRequest,
  mapCollaborationComment,
  mapCollaborationThread,
  parseMentions,
  type ApprovalRequest,
  type CollaborationComment,
  type CollaborationEntityType,
  type CollaborationPriority,
  type CollaborationThread,
} from "@/lib/collaboration";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty } from "./admin-ui";
import { useTeamPresence } from "./use-team-presence";

type Tab = "inbox" | "threads" | "approvals" | "presence";
type EntityOption = { type: Exclude<CollaborationEntityType, "general">; id: string; label: string };

const priorityLabel: Record<CollaborationPriority, string> = { normal: "Normal", high: "Alta", urgent: "Urgente" };

export function CollaborationAdmin() {
  const { data, currentUser, demoMode } = useAdminData();
  const supabase = useMemo(() => createClient(), []);
  const { online, presence, refresh: refreshPresence } = useTeamPresence(true);
  const [tab, setTab] = useState<Tab>("inbox");
  const [threads, setThreads] = useState<CollaborationThread[]>([]);
  const [comments, setComments] = useState<CollaborationComment[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [composeThread, setComposeThread] = useState(false);
  const [composeApproval, setComposeApproval] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [comment, setComment] = useState("");
  const [priority, setPriority] = useState<CollaborationPriority>("normal");
  const [entityValue, setEntityValue] = useState("general::");
  const [reviewerEmail, setReviewerEmail] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<{ item: ApprovalRequest; status: "approved" | "rejected" } | null>(null);
  const [decisionNote, setDecisionNote] = useState("");

  const entities = useMemo<EntityOption[]>(() => [
    ...data.products.map((item) => ({ type: "product" as const, id: item.id, label: item.name })),
    ...data.customers.map((item) => ({ type: "customer" as const, id: item.id, label: item.name })),
    ...data.orders.map((item) => ({ type: "order" as const, id: item.id, label: item.code })),
    ...data.marketingPublications.map((item) => ({ type: "publication" as const, id: item.id, label: item.name })),
    ...data.savedReports.map((item) => ({ type: "report" as const, id: item.id, label: item.name })),
    ...data.purchaseOrders.map((item) => ({ type: "purchase" as const, id: item.id, label: item.code })),
  ], [data.customers, data.marketingPublications, data.orders, data.products, data.purchaseOrders, data.savedReports]);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [threadResult, commentResult, approvalResult] = await Promise.all([
      supabase.from("collaboration_threads").select("*").eq("tenant_id", data.tenant.id).order("updated_at", { ascending: false }),
      supabase.from("collaboration_comments").select("*").eq("tenant_id", data.tenant.id).order("created_at"),
      supabase.from("approval_requests").select("*").eq("tenant_id", data.tenant.id).order("updated_at", { ascending: false }),
    ]);
    const failure = threadResult.error || commentResult.error || approvalResult.error;
    if (failure) { setMessage(failure.message); return; }
    setThreads((threadResult.data ?? []).map((row) => mapCollaborationThread(row as Record<string, unknown>)));
    setComments((commentResult.data ?? []).map((row) => mapCollaborationComment(row as Record<string, unknown>)));
    setApprovals((approvalResult.data ?? []).map((row) => mapApprovalRequest(row as Record<string, unknown>)));
  }, [data.tenant.id, supabase]);

  useEffect(() => {
    void refresh();
    if (!supabase) return;
    const channel = supabase.channel(`collaboration-${data.tenant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "collaboration_threads", filter: `tenant_id=eq.${data.tenant.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "collaboration_comments", filter: `tenant_id=eq.${data.tenant.id}` }, () => void refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests", filter: `tenant_id=eq.${data.tenant.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data.tenant.id, refresh, supabase]);

  const selectedThread = threads.find((thread) => thread.id === selectedThreadId);
  const selectedComments = comments.filter((item) => item.threadId === selectedThreadId);
  const username = currentUser.email.split("@")[0].toLowerCase();
  const mentions = comments.filter((item) => item.actorEmail !== currentUser.email && item.mentions.some((mention) => mention === currentUser.email.toLowerCase() || mention === username));
  const pendingApprovals = approvals.filter((item) => item.status === "pending" && (!item.reviewerEmail || item.reviewerEmail.toLowerCase() === currentUser.email.toLowerCase()));
  const openTasks = data.customerTasks.filter((task) => task.status === "open");
  const inboxCount = mentions.length + pendingApprovals.length + openTasks.length;

  function selectedEntity() {
    const [type, id] = entityValue.split("::") as [CollaborationEntityType, string];
    const entity = entities.find((item) => item.type === type && item.id === id);
    return { type, id: id || "", label: entity?.label ?? "" };
  }

  async function createThread(event: React.FormEvent) {
    event.preventDefault();
    if (title.trim().length < 2 || body.trim().length < 1) { setMessage("Informe um título e a primeira mensagem."); return; }
    setBusy(true);
    const entity = selectedEntity();
    const thread: CollaborationThread = { id: crypto.randomUUID(), title: title.trim(), entityType: entity.type, entityId: entity.id, entityLabel: entity.label, status: "open", priority, createdByEmail: currentUser.email, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const firstComment: CollaborationComment = { id: crypto.randomUUID(), threadId: thread.id, body: body.trim(), mentions: parseMentions(body), actorEmail: currentUser.email, createdAt: new Date().toISOString() };
    try {
      if (supabase) {
        const { error: threadError } = await supabase.from("collaboration_threads").insert({ tenant_id: data.tenant.id, id: thread.id, title: thread.title, entity_type: thread.entityType, entity_id: thread.entityId, entity_label: thread.entityLabel, status: thread.status, priority: thread.priority, created_by: currentUser.id, created_by_email: currentUser.email });
        if (threadError) throw threadError;
        const { error: commentError } = await supabase.from("collaboration_comments").insert({ tenant_id: data.tenant.id, id: firstComment.id, thread_id: thread.id, body: firstComment.body, mentions: firstComment.mentions, actor_id: currentUser.id, actor_email: currentUser.email });
        if (commentError) throw commentError;
        await refresh();
      } else {
        setThreads((current) => [thread, ...current]);
        setComments((current) => [...current, firstComment]);
      }
      setSelectedThreadId(thread.id); setTitle(""); setBody(""); setComposeThread(false); setMessage("Discussão criada e disponível para a equipe.");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Não foi possível criar a discussão."); }
    finally { setBusy(false); }
  }

  async function sendComment(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedThread || !comment.trim()) return;
    const item: CollaborationComment = { id: crypto.randomUUID(), threadId: selectedThread.id, body: comment.trim(), mentions: parseMentions(comment), actorEmail: currentUser.email, createdAt: new Date().toISOString() };
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("collaboration_comments").insert({ tenant_id: data.tenant.id, id: item.id, thread_id: item.threadId, body: item.body, mentions: item.mentions, actor_id: currentUser.id, actor_email: currentUser.email });
        if (error) throw error;
        await supabase.from("collaboration_threads").update({ updated_at: new Date().toISOString() }).eq("tenant_id", data.tenant.id).eq("id", selectedThread.id);
        await refresh();
      } else setComments((current) => [...current, item]);
      setComment("");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Não foi possível enviar a mensagem."); }
    finally { setBusy(false); }
  }

  async function setThreadStatus(thread: CollaborationThread, status: CollaborationThread["status"]) {
    if (supabase) {
      const { error } = await supabase.from("collaboration_threads").update({ status }).eq("tenant_id", data.tenant.id).eq("id", thread.id);
      if (error) { setMessage(error.message); return; }
      await refresh();
    } else setThreads((current) => current.map((item) => item.id === thread.id ? { ...item, status, updatedAt: new Date().toISOString() } : item));
  }

  async function createApproval(event: React.FormEvent) {
    event.preventDefault();
    const entity = selectedEntity();
    if (entity.type === "general" || !entity.id) { setMessage("Selecione um item para aprovação."); return; }
    const item: ApprovalRequest = { id: crypto.randomUUID(), threadId: selectedThreadId, entityType: entity.type, entityId: entity.id, entityLabel: entity.label, requestNote: body.trim(), status: "pending", requestedByEmail: currentUser.email, reviewerEmail, decisionNote: "", dueAt: dueAt ? new Date(dueAt).toISOString() : "", createdAt: new Date().toISOString(), decidedAt: "", updatedAt: new Date().toISOString() };
    setBusy(true);
    try {
      if (supabase) {
        const { error } = await supabase.from("approval_requests").insert({ tenant_id: data.tenant.id, id: item.id, thread_id: item.threadId || null, entity_type: item.entityType, entity_id: item.entityId, entity_label: item.entityLabel, request_note: item.requestNote, requested_by: currentUser.id, requested_by_email: currentUser.email, reviewer_email: item.reviewerEmail, due_at: item.dueAt || null });
        if (error) throw error;
        await refresh();
      } else setApprovals((current) => [item, ...current]);
      setComposeApproval(false); setBody(""); setReviewerEmail(""); setDueAt(""); setMessage("Solicitação de aprovação criada.");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Não foi possível solicitar aprovação."); }
    finally { setBusy(false); }
  }

  async function decideApproval(event: React.FormEvent) {
    event.preventDefault();
    if (!decisionTarget || (decisionTarget.status === "rejected" && !decisionNote.trim())) return;
    const { item, status } = decisionTarget;
    const update = { status, decision_note: decisionNote.trim(), decided_at: new Date().toISOString() };
    if (supabase) {
      const { error } = await supabase.from("approval_requests").update(update).eq("tenant_id", data.tenant.id).eq("id", item.id);
      if (error) { setMessage(error.message); return; }
      await refresh();
    } else setApprovals((current) => current.map((approval) => approval.id === item.id ? { ...approval, status, decisionNote: decisionNote.trim(), decidedAt: update.decided_at, updatedAt: update.decided_at } : approval));
    setDecisionTarget(null); setDecisionNote(""); setMessage(status === "approved" ? "Item aprovado." : "Item devolvido para ajustes.");
  }

  return <div className="collaboration-page">
    <section className="collaboration-hero">
      <div><span><UsersRound /> TRABALHO EM EQUIPE</span><h2>Todo mundo alinhado, sem perder contexto.</h2><p>Tarefas, discussões, menções e aprovações conectadas aos registros do painel.</p></div>
      <aside><Radio /><strong>{online.length}</strong><span>online agora</span><small>{threads.filter((item) => item.status === "open").length} discussões abertas</small></aside>
    </section>

    <nav className="collaboration-tabs" aria-label="Central da equipe">
      <button className={tab === "inbox" ? "active" : ""} onClick={() => setTab("inbox")}><Inbox /> Caixa de entrada <b>{inboxCount}</b></button>
      <button className={tab === "threads" ? "active" : ""} onClick={() => setTab("threads")}><MessageSquareText /> Discussões <b>{threads.filter((item) => item.status === "open").length}</b></button>
      <button className={tab === "approvals" ? "active" : ""} onClick={() => setTab("approvals")}><FileCheck2 /> Aprovações <b>{approvals.filter((item) => item.status === "pending").length}</b></button>
      <button className={tab === "presence" ? "active" : ""} onClick={() => { setTab("presence"); void refreshPresence(); }}><CircleDot /> Presença <b>{online.length}</b></button>
    </nav>

    {message && <div className="collaboration-notice" role="status"><Check /> {message}<button onClick={() => setMessage("")}><X /></button></div>}

    {tab === "inbox" && <div className="collaboration-inbox-grid">
      <section><header><div><Inbox /><span><strong>Prioridades para você</strong><small>Tarefas, menções e pedidos de decisão.</small></span></div><em>{inboxCount}</em></header>
        <div className="collaboration-feed">
          {pendingApprovals.map((item) => <article key={`approval-${item.id}`}><span className="approval"><FileCheck2 /></span><div><small>APROVAÇÃO SOLICITADA</small><strong>{item.entityLabel}</strong><p>{item.requestNote || `Solicitado por ${item.requestedByEmail}`}</p></div><button onClick={() => { setTab("approvals"); }}><UserRoundCheck /> Revisar</button></article>)}
          {mentions.map((item) => { const thread = threads.find((candidate) => candidate.id === item.threadId); return <article key={`mention-${item.id}`}><span className="mention"><AtSign /></span><div><small>VOCÊ FOI MENCIONADO</small><strong>{thread?.title || "Discussão da equipe"}</strong><p>{item.body}</p></div><button onClick={() => { setSelectedThreadId(item.threadId); setTab("threads"); }}><MessageSquareText /> Responder</button></article>; })}
          {openTasks.slice(0, 8).map((task) => <article key={`task-${task.id}`}><span className="task"><Clock3 /></span><div><small>TAREFA DO CRM</small><strong>{task.title}</strong><p>{task.assignedTo || "Sem responsável"}{task.dueAt ? ` · ${formatDateTime(task.dueAt)}` : ""}</p></div><Link href="/admin/crm"><CheckCircle2 /> Abrir CRM</Link></article>)}
          {!inboxCount && <AdminEmpty><ShieldCheck /><strong>Caixa de entrada em dia.</strong><span>Nenhuma pendência direcionada a você.</span></AdminEmpty>}
        </div>
      </section>
      <aside><header><Radio /><span><strong>Equipe ativa</strong><small>Atualização automática</small></span></header>{online.map((item) => <article key={item.userId}><i>{(item.fullName || item.email).slice(0, 1).toUpperCase()}</i><span><strong>{item.fullName || item.email}</strong><small>{item.route.replace("/admin", "Painel") || "Painel"}</small></span><b>Online</b></article>)}{!online.length && <p>Ninguém online no momento.</p>}</aside>
    </div>}

    {tab === "threads" && <div className="collaboration-thread-layout">
      <section className="thread-list"><header><div><strong>Discussões da equipe</strong><small>Contexto preservado por assunto.</small></div><button onClick={() => setComposeThread(true)}><Plus /> Nova discussão</button></header>{threads.map((thread) => <button key={thread.id} className={selectedThreadId === thread.id ? "active" : ""} onClick={() => setSelectedThreadId(thread.id)}><span className={thread.priority}><MessageSquareText /></span><div><strong>{thread.title}</strong><small>{thread.entityLabel || collaborationEntityLabels[thread.entityType]} · {comments.filter((item) => item.threadId === thread.id).length} mensagens</small></div><em className={thread.status}>{thread.status === "open" ? "Aberta" : thread.status === "resolved" ? "Resolvida" : "Arquivada"}</em></button>)}{!threads.length && <AdminEmpty><MessageSquareText /><strong>Nenhuma discussão.</strong><span>Crie um tópico e preserve as decisões da equipe.</span></AdminEmpty>}</section>
      <section className="thread-detail">{selectedThread ? <><header><div><span>{collaborationEntityLabels[selectedThread.entityType]}{selectedThread.entityLabel ? ` · ${selectedThread.entityLabel}` : ""}</span><h3>{selectedThread.title}</h3><small>Criada por {selectedThread.createdByEmail} · {formatDateTime(selectedThread.createdAt)}</small></div><button onClick={() => void setThreadStatus(selectedThread, selectedThread.status === "open" ? "resolved" : "open")}>{selectedThread.status === "open" ? <CheckCircle2 /> : <CircleDot />}{selectedThread.status === "open" ? "Resolver" : "Reabrir"}</button></header><div className="thread-messages">{selectedComments.map((item) => <article key={item.id}><i>{item.actorEmail.slice(0, 1).toUpperCase()}</i><div><header><strong>{item.actorEmail}</strong><time>{formatDateTime(item.createdAt)}</time></header><p>{item.body}</p>{item.mentions.length > 0 && <small><AtSign /> {item.mentions.join(", ")}</small>}</div></article>)}</div><form onSubmit={sendComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Responder à equipe… Use @nome ou @email para mencionar." rows={3} /><footer><small><ShieldCheck /> Mensagens ficam no histórico de auditoria.</small><button disabled={busy || !comment.trim()}><Send /> Enviar</button></footer></form></> : <AdminEmpty><MessageSquareText /><strong>Selecione uma discussão.</strong><span>As mensagens e decisões aparecerão aqui.</span></AdminEmpty>}</section>
    </div>}

    {tab === "approvals" && <section className="approval-center"><header><div><FileCheck2 /><span><strong>Fluxo de aprovações</strong><small>Decisões explícitas, com responsável e histórico.</small></span></div><button onClick={() => setComposeApproval(true)}><Plus /> Solicitar aprovação</button></header><div>{approvals.map((item) => <article key={item.id}><span className={item.status}>{item.status === "approved" ? <CheckCircle2 /> : item.status === "rejected" ? <XCircle /> : <Clock3 />}</span><div><small>{collaborationEntityLabels[item.entityType]} · {item.reviewerEmail || "Qualquer revisor"}</small><strong>{item.entityLabel}</strong><p>{item.requestNote || "Sem observações."}</p>{item.decisionNote && <blockquote>{item.decisionNote}</blockquote>}</div><time>{item.dueAt ? `Até ${formatDateTime(item.dueAt)}` : formatDateTime(item.createdAt)}</time>{item.status === "pending" && <footer><button onClick={() => setDecisionTarget({ item, status: "rejected" })}><XCircle /> Rejeitar</button><button className="approve" onClick={() => setDecisionTarget({ item, status: "approved" })}><CheckCircle2 /> Aprovar</button></footer>}</article>)}{!approvals.length && <AdminEmpty><FileCheck2 /><strong>Nenhuma aprovação solicitada.</strong><span>Use este fluxo para decisões que precisam de rastreabilidade.</span></AdminEmpty>}</div></section>}

    {tab === "presence" && <section className="presence-center"><header><div><Radio /><span><strong>Presença e edição concorrente</strong><small>Online em até 90 segundos; editores de produto recebem uma trava temporária.</small></span></div><em>{online.length} online de {presence.length} recentes</em></header><div>{presence.map((item) => { const active = online.some((candidate) => candidate.userId === item.userId); return <article key={item.userId}><i>{(item.fullName || item.email).slice(0, 1).toUpperCase()}</i><div><strong>{item.fullName || item.email}</strong><small>{item.email}</small></div><span>{item.route.replace("/admin", "Painel") || "Painel"}</span><time>{active ? "Online agora" : `Visto ${formatDateTime(item.lastSeenAt)}`}</time><b className={active ? "online" : "offline"}>{active ? "Online" : "Ausente"}</b></article>; })}</div></section>}

    {composeThread && <div className="collaboration-modal" role="dialog" aria-modal="true" aria-label="Nova discussão"><form onSubmit={createThread}><header><div><MessageSquareText /><span><strong>Nova discussão</strong><small>Conecte a conversa ao registro certo.</small></span></div><button type="button" onClick={() => setComposeThread(false)}><X /></button></header><label>Título<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} /></label><div className="collaboration-form-grid"><label>Contexto<select value={entityValue} onChange={(event) => setEntityValue(event.target.value)}><option value="general::">Assunto geral</option>{entities.map((item) => <option key={`${item.type}-${item.id}`} value={`${item.type}::${item.id}`}>{collaborationEntityLabels[item.type]} · {item.label}</option>)}</select></label><label>Prioridade<select value={priority} onChange={(event) => setPriority(event.target.value as CollaborationPriority)}>{Object.entries(priorityLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div><label>Primeira mensagem<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={5} placeholder="Explique o contexto e mencione alguém com @email." /></label><footer><button type="button" onClick={() => setComposeThread(false)}>Cancelar</button><button className="primary" disabled={busy}><Send /> Criar discussão</button></footer></form></div>}

    {composeApproval && <div className="collaboration-modal" role="dialog" aria-modal="true" aria-label="Solicitar aprovação"><form onSubmit={createApproval}><header><div><FileCheck2 /><span><strong>Solicitar aprovação</strong><small>Defina o item e quem deve decidir.</small></span></div><button type="button" onClick={() => setComposeApproval(false)}><X /></button></header><label>Item<select value={entityValue} onChange={(event) => setEntityValue(event.target.value)}><option value="general::">Selecione…</option>{entities.map((item) => <option key={`${item.type}-${item.id}`} value={`${item.type}::${item.id}`}>{collaborationEntityLabels[item.type]} · {item.label}</option>)}</select></label><div className="collaboration-form-grid"><label>Revisor (opcional)<input type="email" list="collaboration-reviewers" value={reviewerEmail} onChange={(event) => setReviewerEmail(event.target.value)} placeholder="Qualquer usuário autorizado" /><datalist id="collaboration-reviewers">{data.teamMembers.filter((member) => member.active).map((member) => <option key={member.id} value={member.email}>{member.fullName}</option>)}</datalist></label><label>Prazo<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></label></div><label>Observação<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={4} placeholder="O que precisa ser conferido?" /></label><footer><button type="button" onClick={() => setComposeApproval(false)}>Cancelar</button><button className="primary" disabled={busy}><UserRoundCheck /> Enviar para aprovação</button></footer></form></div>}

    {decisionTarget && <div className="collaboration-modal" role="dialog" aria-modal="true" aria-label={decisionTarget.status === "approved" ? "Aprovar item" : "Rejeitar item"}><form onSubmit={decideApproval}><header><div>{decisionTarget.status === "approved" ? <CheckCircle2 /> : <XCircle />}<span><strong>{decisionTarget.status === "approved" ? "Aprovar item" : "Solicitar ajustes"}</strong><small>{decisionTarget.item.entityLabel}</small></span></div><button type="button" onClick={() => { setDecisionTarget(null); setDecisionNote(""); }}><X /></button></header><label>{decisionTarget.status === "approved" ? "Observação (opcional)" : "Motivo da rejeição"}<textarea autoFocus value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} rows={4} placeholder={decisionTarget.status === "approved" ? "Registre uma orientação para a equipe." : "Explique o que precisa ser ajustado."} /></label><footer><button type="button" onClick={() => { setDecisionTarget(null); setDecisionNote(""); }}>Cancelar</button><button className="primary" disabled={decisionTarget.status === "rejected" && !decisionNote.trim()}>{decisionTarget.status === "approved" ? <CheckCircle2 /> : <XCircle />}{decisionTarget.status === "approved" ? "Confirmar aprovação" : "Enviar para ajustes"}</button></footer></form></div>}

    {demoMode && <small className="collaboration-demo-note"><ShieldCheck /> No modo local, as colaborações permanecem apenas nesta sessão.</small>}
  </div>;
}
