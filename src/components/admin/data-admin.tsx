"use client";

import { Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";

export function DataAdmin() {
  const { data, demoMode, clearOrders, resetData, importData } = useAdminData();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  function exportData() {
    const blob = new Blob([JSON.stringify({ ...data, teamMembers: [] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "junior-imports-dados.json";
    link.click();
    URL.revokeObjectURL(url);
  }
  return <><div className="admin-inline-note">{demoMode ? "No modo local, os dados ficam neste navegador. Exporte um backup antes de limpar o armazenamento." : "O Supabase é a fonte principal. A importação e restauração local ficam desativadas para proteger dados remotos."}</div><AdminPanel title="Backup e manutenção" description="Exporte, importe ou restaure o projeto demonstrativo."><div className="data-actions"><article><Download /><h3>Exportar dados</h3><p>Baixe produtos, páginas, containers, banners, automações, configurações e pedidos em JSON.</p><button className="admin-button primary" onClick={exportData}>Exportar JSON</button></article><article><Upload /><h3>Importar dados</h3><p>Restaure um arquivo exportado anteriormente no modo local.</p><button className="admin-button" disabled={!demoMode} onClick={() => fileRef.current?.click()}>Selecionar arquivo</button><input ref={fileRef} type="file" accept="application/json" hidden onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => { try { importData(JSON.parse(String(reader.result))); setMessage("Dados importados com sucesso."); } catch { setMessage("Arquivo inválido."); } }; reader.readAsText(file); }} /></article><article><Trash2 /><h3>Limpar pedidos</h3><p>Apaga somente os pedidos demonstrativos registrados.</p><button className="admin-button danger" onClick={() => window.confirm("Apagar todos os pedidos demonstrativos?") && clearOrders()}>Limpar pedidos</button></article><article><RotateCcw /><h3>Restaurar dados</h3><p>Volta o modo local ao estado inicial desta migração.</p><button className="admin-button danger" disabled={!demoMode} onClick={() => { if (window.confirm("Restaurar os dados iniciais?")) { resetData(); setMessage("Dados restaurados."); } }}>Restaurar padrão</button></article></div>{message && <p className="admin-data-message">{message}</p>}</AdminPanel></>;
}
