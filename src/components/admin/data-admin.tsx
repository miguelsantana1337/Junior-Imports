"use client";

import { ChevronDown, ChevronUp, Download, History, RotateCcw, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import { Fragment, useMemo, useRef, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatDateTime } from "@/lib/format";
import { auditChanges } from "@/lib/audit-log";
import type { StoreData } from "@/types/store";

function isStoreDataBackup(value: unknown): value is StoreData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoreData>;
  return Boolean(candidate.settings && typeof candidate.settings.storeName === "string")
    && ["products", "categories", "banners", "sections", "pages", "pageBlocks", "coupons", "orders"]
      .every((key) => Array.isArray(candidate[key as keyof StoreData]));
}

export function DataAdmin() {
  const { data, demoMode, currentUser, clearOrders, resetData, importData } = useAdminData();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [auditQuery, setAuditQuery] = useState("");
  const [auditAction, setAuditAction] = useState("all");
  const [auditEntity, setAuditEntity] = useState("all");
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const entityTypes = useMemo(() => [...new Set(data.auditLogs.map((log) => log.entityType))].sort((a, b) => a.localeCompare(b, "pt-BR")), [data.auditLogs]);
  const filteredAuditLogs = useMemo(() => data.auditLogs.filter((log) => {
    const normalized = auditQuery.trim().toLocaleLowerCase("pt-BR");
    const matchesQuery = !normalized || `${log.actorEmail} ${log.entityType} ${log.entityLabel} ${log.entityId}`.toLocaleLowerCase("pt-BR").includes(normalized);
    return matchesQuery && (auditAction === "all" || log.action === auditAction) && (auditEntity === "all" || log.entityType === auditEntity);
  }), [auditAction, auditEntity, auditQuery, data.auditLogs]);

  function exportData() {
    const blob = new Blob([JSON.stringify({ ...data, teamMembers: [], auditLogs: [] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "junior-imports-dados.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importBackup(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const candidate = JSON.parse(String(reader.result)) as unknown;
        if (!isStoreDataBackup(candidate)) throw new Error("Formato inválido");
        importData(candidate);
        setMessage("Dados importados com sucesso.");
      } catch {
        setMessage("Arquivo inválido ou incompatível.");
      }
    };
    reader.onerror = () => setMessage("Não foi possível ler o arquivo.");
    reader.readAsText(file);
  }

  return (
    <>
      <div className="admin-inline-note">
        {demoMode
          ? "No modo local, os dados ficam neste navegador. Exporte um backup antes de limpar o armazenamento."
          : "O Supabase é a fonte principal. A importação e restauração local ficam desativadas para proteger dados remotos."}
      </div>
      <AdminPanel title="Backup e manutenção" description="Exporte, importe ou restaure o projeto demonstrativo.">
        <div className="data-actions">
          <article><Download /><h3>Exportar dados</h3><p>Baixe produtos, páginas, containers, banners, automações, configurações e pedidos em JSON.</p><button className="admin-button primary" onClick={exportData}>Exportar JSON</button></article>
          <article><Upload /><h3>Importar dados</h3><p>Restaure um arquivo exportado anteriormente no modo local.</p><button className="admin-button" disabled={!demoMode} onClick={() => fileRef.current?.click()}>Selecionar arquivo</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) importBackup(file); event.target.value = ""; }} /></article>
          <article><Trash2 /><h3>Limpar pedidos</h3><p>Apaga somente os pedidos demonstrativos registrados.</p><button className="admin-button danger" onClick={async () => { const accepted = await confirm({ title: "Limpar pedidos?", description: "Todos os pedidos e registros de mensagens demonstrativos serão removidos.", confirmLabel: "Limpar pedidos", danger: true }); if (accepted) await clearOrders(); }}>Limpar pedidos</button></article>
          <article><RotateCcw /><h3>Restaurar dados</h3><p>Volta o modo local ao estado inicial desta migração.</p><button className="admin-button danger" disabled={!demoMode} onClick={async () => { const accepted = await confirm({ title: "Restaurar dados iniciais?", description: "Todas as personalizações locais serão substituídas pela base original.", confirmLabel: "Restaurar padrão", danger: true }); if (accepted) { resetData(); setMessage("Dados restaurados."); } }}>Restaurar padrão</button></article>
        </div>
        {message && <p className="admin-data-message" role="status">{message}</p>}
      </AdminPanel>

      {(currentUser.role === "owner" || currentUser.permissions.includes("audit")) && <AdminPanel title="Auditoria administrativa" description="Consulte quem alterou cada registro e compare os valores anteriores e posteriores.">
        <div className="admin-list-toolbar audit-toolbar">
          <label className="admin-search-field"><Search /><input value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} placeholder="Buscar usuário, tipo ou item" aria-label="Buscar no histórico de auditoria" /></label>
          <label><span>Ação</span><select value={auditAction} onChange={(event) => setAuditAction(event.target.value)}><option value="all">Todas</option><option value="insert">Criação</option><option value="update">Atualização</option><option value="delete">Exclusão</option></select></label>
          <label><span>Tipo</span><select value={auditEntity} onChange={(event) => setAuditEntity(event.target.value)}><option value="all">Todos</option>{entityTypes.map((entity) => <option value={entity} key={entity}>{entity}</option>)}</select></label>
          <strong>{filteredAuditLogs.length} registro{filteredAuditLogs.length === 1 ? "" : "s"}</strong>
        </div>
        <div className="admin-table-wrap">
          <table className="admin-table audit-table">
            <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Tipo</th><th>Item</th><th>Detalhes</th></tr></thead>
            <tbody>
              {filteredAuditLogs.map((log) => {
                const expanded = expandedAudit === log.id;
                const changes = auditChanges(log);
                return <Fragment key={log.id}><tr><td>{formatDateTime(log.createdAt)}</td><td>{log.actorEmail || "Equipe"}</td><td><strong>{log.action === "insert" ? "Criação" : log.action === "delete" ? "Exclusão" : "Atualização"}</strong></td><td>{log.entityType}</td><td>{log.entityLabel || log.entityId}</td><td><button className="audit-details-button" onClick={() => setExpandedAudit(expanded ? null : log.id)} aria-expanded={expanded}>{expanded ? <ChevronUp /> : <ChevronDown />} {changes.length} mudança{changes.length === 1 ? "" : "s"}</button></td></tr>{expanded && <tr className="audit-diff-row"><td colSpan={6}><div className="audit-diff"><header><ShieldCheck /><div><strong>Comparação protegida</strong><span>Campos de autenticação, chaves e credenciais nunca são exibidos.</span></div></header>{changes.length ? <div className="audit-diff-grid"><b>Campo</b><b>Antes</b><b>Depois</b>{changes.map((change) => <div className="audit-diff-entry" key={change.key}><code>{change.key}</code><span>{change.before}</span><span>{change.after}</span></div>)}</div> : <p>Nenhum campo comparável foi registrado para esta ação.</p>}</div></td></tr>}</Fragment>;
              })}
              {!filteredAuditLogs.length && <tr><td colSpan={6}><div className="message-log-empty"><History /><strong>Nenhuma alteração encontrada.</strong><span>{data.auditLogs.length ? "Ajuste os filtros da auditoria." : "O histórico aparecerá após uma alteração administrativa."}</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>}
    </>
  );
}
