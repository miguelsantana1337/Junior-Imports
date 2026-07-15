"use client";

import { Download, History, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatDateTime } from "@/lib/format";
import type { StoreData } from "@/types/store";

function isStoreDataBackup(value: unknown): value is StoreData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StoreData>;
  return Boolean(candidate.settings && typeof candidate.settings.storeName === "string")
    && ["products", "categories", "banners", "sections", "pages", "pageBlocks", "coupons", "orders"]
      .every((key) => Array.isArray(candidate[key as keyof StoreData]));
}

export function DataAdmin() {
  const { data, demoMode, clearOrders, resetData, importData } = useAdminData();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");

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

      <AdminPanel title="Auditoria administrativa" description="Histórico das alterações feitas pela equipe no Supabase.">
        <div className="admin-table-wrap">
          <table className="admin-table audit-table">
            <thead><tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Tipo</th><th>Item</th></tr></thead>
            <tbody>
              {data.auditLogs.map((log) => <tr key={log.id}><td>{formatDateTime(log.createdAt)}</td><td>{log.actorEmail || "Equipe"}</td><td><strong>{log.action === "insert" ? "Criação" : log.action === "delete" ? "Exclusão" : "Atualização"}</strong></td><td>{log.entityType}</td><td>{log.entityLabel || log.entityId}</td></tr>)}
              {!data.auditLogs.length && <tr><td colSpan={5}><div className="message-log-empty"><History /><strong>Nenhuma alteração auditada.</strong><span>O histórico aparecerá após a migração de confiabilidade ser aplicada.</span></div></td></tr>}
            </tbody>
          </table>
        </div>
      </AdminPanel>
    </>
  );
}
