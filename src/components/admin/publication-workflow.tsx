"use client";

import { Archive, CalendarClock, CheckCircle2, ChevronRight, CirclePause, Eye, FileClock, GitPullRequestArrow, History, Pencil, Plus, RotateCcw, Send, X } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatDateTime } from "@/lib/format";
import { canTransitionPublication, publicationNextStatuses } from "@/lib/marketing";
import { marketingPublicationSchema } from "@/lib/validation";
import type { MarketingPublication, MarketingPublicationKind, MarketingPublicationStatus } from "@/types/store";
import { useAdminData } from "./admin-data-provider";

const kindLabels: Record<MarketingPublicationKind, string> = { campaign: "Campanha coordenada", banner: "Banner", coupon: "Cupom", cashback: "Cashback", message: "Mensagem automática" };
const statusLabels: Record<MarketingPublicationStatus, string> = { draft: "Rascunho", in_review: "Em revisão", approved: "Aprovada", scheduled: "Agendada", published: "No ar", paused: "Pausada", archived: "Encerrada" };
const columns: Array<{ id: MarketingPublicationStatus; title: string; description: string; statuses: MarketingPublicationStatus[] }> = [
  { id: "draft", title: "Rascunho", description: "Conteúdo em preparação", statuses: ["draft"] },
  { id: "in_review", title: "Revisão", description: "Aguardando validação", statuses: ["in_review"] },
  { id: "approved", title: "Aprovado", description: "Pronto para agendar", statuses: ["approved"] },
  { id: "scheduled", title: "Distribuição", description: "Agendado, no ar ou pausado", statuses: ["scheduled", "published", "paused", "archived"] },
];

const nextAction: Partial<Record<MarketingPublicationStatus, { label: string; icon: typeof Send }>> = {
  in_review: { label: "Enviar para revisão", icon: Send },
  approved: { label: "Aprovar", icon: CheckCircle2 },
  scheduled: { label: "Agendar", icon: CalendarClock },
  published: { label: "Publicar agora", icon: Eye },
  paused: { label: "Pausar", icon: CirclePause },
  archived: { label: "Encerrar", icon: Archive },
  draft: { label: "Voltar a rascunho", icon: FileClock },
};

function localDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function isoDateTime(value: string) { return value ? new Date(value).toISOString() : ""; }

export function newMarketingPublication(ownerEmail: string): MarketingPublication {
  const now = new Date();
  return { id: crypto.randomUUID(), name: "", description: "", kind: "campaign", entityId: "", status: "draft", startsAt: now.toISOString(), endsAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(), ownerEmail, reviewerEmail: "", revision: 1, notes: "", lastPublishedAt: "", createdAt: now.toISOString(), updatedAt: now.toISOString() };
}

export function PublicationWorkflow({ onOpen, onNew }: { onOpen: (publication: MarketingPublication) => void; onNew: () => void }) {
  const { data, transitionMarketingPublication } = useAdminData();
  const [draggedId, setDraggedId] = useState("");
  const [dropTarget, setDropTarget] = useState<MarketingPublicationStatus | "">("");

  async function drop(event: DragEvent, target: MarketingPublicationStatus) {
    event.preventDefault();
    const publication = data.marketingPublications.find((item) => item.id === draggedId);
    setDraggedId(""); setDropTarget("");
    if (!publication || !canTransitionPublication(publication.status, target)) return;
    await transitionMarketingPublication(publication.id, target, `Movida para ${statusLabels[target]} pelo quadro editorial`);
  }

  return <section className="publication-workflow-shell">
    <header className="marketing-section-header"><div><span>WORKFLOW DE PUBLICAÇÃO</span><h2>Da ideia à publicação, com aprovação e histórico</h2><p>Arraste os cards entre etapas ou use as ações guiadas. Toda mudança gera uma revisão recuperável.</p></div><button className="admin-button primary" onClick={onNew}><Plus /> Nova publicação</button></header>
    <div className="publication-board">{columns.map((column) => {
      const cards = data.marketingPublications.filter((item) => column.statuses.includes(item.status));
      return <section key={column.id} className={`publication-column ${dropTarget === column.id ? "is-drop-target" : ""}`} onDragOver={(event) => { event.preventDefault(); const publication = data.marketingPublications.find((item) => item.id === draggedId); if (publication && canTransitionPublication(publication.status, column.id)) setDropTarget(column.id); }} onDragLeave={() => setDropTarget("")} onDrop={(event) => { void drop(event, column.id); }}>
        <header><div><strong>{column.title}</strong><span>{column.description}</span></div><b>{cards.length}</b></header>
        <div>{cards.map((publication) => <article draggable onDragStart={() => setDraggedId(publication.id)} onDragEnd={() => { setDraggedId(""); setDropTarget(""); }} className={`${publication.status} ${draggedId === publication.id ? "is-dragging" : ""}`} key={publication.id} onClick={() => onOpen(publication)}>
          <header><span className={`publication-kind ${publication.kind}`}>{kindLabels[publication.kind]}</span><button aria-label={`Editar ${publication.name}`} onClick={(event) => { event.stopPropagation(); onOpen(publication); }}><Pencil /></button></header>
          <h3>{publication.name}</h3><p>{publication.description || "Sem descrição editorial."}</p>
          <div className="publication-card-meta"><span><CalendarClock /> {formatDateTime(publication.startsAt)}</span><span><GitPullRequestArrow /> Revisão {publication.revision}</span></div>
          <footer><span className={`publication-status ${publication.status}`}>{statusLabels[publication.status]}</span><small>{publication.reviewerEmail ? `Revisor: ${publication.reviewerEmail.split("@")[0]}` : "Sem revisor"}</small></footer>
        </article>)}</div>
        {!cards.length && <div className="publication-column-empty"><GitPullRequestArrow /><span>Solte um item elegível aqui</span></div>}
      </section>;
    })}</div>
  </section>;
}

export function PublicationEditor({ publication, onClose }: { publication: MarketingPublication; onClose: () => void }) {
  const { data, saveMarketingPublication, transitionMarketingPublication, rollbackMarketingPublication } = useAdminData();
  const confirm = useConfirm();
  const [form, setForm] = useState(publication);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const versions = useMemo(() => data.marketingPublicationVersions.filter((item) => item.publicationId === publication.id).sort((a, b) => b.revision - a.revision), [data.marketingPublicationVersions, publication.id]);
  const entityOptions = form.kind === "banner" ? data.banners.map((item) => ({ id: item.id, name: item.title || item.kicker })) : form.kind === "coupon" ? data.coupons.map((item) => ({ id: item.id, name: item.code })) : form.kind === "cashback" ? data.cashbackCampaigns.map((item) => ({ id: item.id, name: item.name })) : form.kind === "message" ? data.messageAutomations.map((item) => ({ id: item.id, name: item.name })) : [];
  const nextStatuses = publicationNextStatuses(publication.status);
  const field = <K extends keyof MarketingPublication>(key: K, value: MarketingPublication[K]) => setForm((current) => ({ ...current, [key]: value }));

  async function save() {
    const parsed = marketingPublicationSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise a publicação."); return; }
    setSaving(true); setError("");
    try { await saveMarketingPublication(parsed.data); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar."); } finally { setSaving(false); }
  }

  async function transition(status: MarketingPublicationStatus) {
    setSaving(true); setError("");
    try { await transitionMarketingPublication(publication.id, status, `${statusLabels[publication.status]} → ${statusLabels[status]}`); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível avançar o workflow."); } finally { setSaving(false); }
  }

  return createPortal(<div className="admin-modal publication-editor-modal" role="dialog" aria-modal="true" aria-label={`Publicação ${publication.name || "nova"}`}><button className="admin-modal-overlay" aria-label="Fechar" onClick={onClose} /><div className="publication-editor-panel">
    <header><div><span>PUBLICAÇÃO · REVISÃO {publication.revision}</span><h2>{publication.name || "Nova publicação"}</h2><p>Edite o conteúdo, configure o período e acompanhe cada decisão.</p></div><button aria-label="Fechar" onClick={onClose}><X /></button></header>
    <div className="publication-editor-layout"><form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label className="full">Nome da publicação<input value={form.name} onChange={(event) => field("name", event.target.value)} autoFocus /></label>
      <label className="full">Descrição editorial<textarea rows={3} value={form.description} onChange={(event) => field("description", event.target.value)} /></label>
      <label>Tipo<select value={form.kind} onChange={(event) => { field("kind", event.target.value as MarketingPublicationKind); field("entityId", ""); }}>{Object.entries(kindLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      <label>Conteúdo vinculado<select value={form.entityId} disabled={form.kind === "campaign"} onChange={(event) => field("entityId", event.target.value)}><option value="">{form.kind === "campaign" ? "Campanha coordenada" : "Selecione"}</option>{entityOptions.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <label>Início<input type="datetime-local" value={localDateTime(form.startsAt)} onChange={(event) => field("startsAt", isoDateTime(event.target.value))} /></label>
      <label>Término<input type="datetime-local" value={localDateTime(form.endsAt)} onChange={(event) => field("endsAt", isoDateTime(event.target.value))} /></label>
      <label>Responsável<input type="email" value={form.ownerEmail} onChange={(event) => field("ownerEmail", event.target.value)} /></label>
      <label>Revisor<input type="email" value={form.reviewerEmail} onChange={(event) => field("reviewerEmail", event.target.value)} placeholder="Obrigatório para aprovar" /></label>
      <label className="full">Notas internas<textarea rows={4} value={form.notes} onChange={(event) => field("notes", event.target.value)} /></label>
      {error && <p className="admin-form-error full" role="alert">{error}</p>}
      <div className="publication-editor-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar revisão"}</button></div>
    </form><aside>
      <section className="publication-current-stage"><span>ETAPA ATUAL</span><strong className={publication.status}>{statusLabels[publication.status]}</strong><p>As ações disponíveis respeitam a ordem de aprovação.</p><div>{nextStatuses.map((status) => { const action = nextAction[status]; if (!action) return null; const Icon = action.icon; return <button key={status} disabled={saving} onClick={() => { void transition(status); }}><Icon /><span>{action.label}</span><ChevronRight /></button>; })}</div></section>
      <section className="publication-version-history"><header><History /><div><strong>Histórico de versões</strong><span>{versions.length} registro{versions.length === 1 ? "" : "s"}</span></div></header>{versions.map((version) => <article key={version.id}><i /><div><strong>Revisão {version.revision} · {statusLabels[version.status]}</strong><span>{version.note || "Alteração editorial"}</span><small>{formatDateTime(version.createdAt)} · {version.actorEmail || "sistema"}</small></div>{version.revision < publication.revision && <button title={`Restaurar revisão ${version.revision}`} onClick={async () => { const accepted = await confirm({ title: `Restaurar a revisão ${version.revision}?`, description: "A versão será restaurada como um novo rascunho, sem apagar o histórico atual.", confirmLabel: "Restaurar versão" }); if (accepted) { await rollbackMarketingPublication(publication.id, version.id); onClose(); } }}><RotateCcw /></button>}</article>)}{!versions.length && <p>Nenhuma versão anterior.</p>}</section>
    </aside></div>
  </div></div>, document.body);
}
