"use client";

import { CheckCircle2, DatabaseBackup, KeyRound, LoaderCircle, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { mfaFactorName, type AdminMfaFactor } from "@/lib/admin-mfa";
import {
  createEncryptedBrowserBackup,
  downloadBackupFile,
  type BrowserBackupProgress,
  type PreparedBrowserBackup,
} from "@/lib/browser-backup";
import { createClient } from "@/lib/supabase/client";

type PreparedResponse = PreparedBrowserBackup & {
  runId: string;
  completionToken: string;
  summary: { tableCount: number; rowCount: number; mediaCount: number; mediaBytes: number };
};

type BackupUser = { email: string; role: string };

function formatBytes(value: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

async function reportCompletion(prepared: PreparedResponse, body: Record<string, unknown>) {
  return fetch("/api/admin/backups/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId: prepared.runId,
      completionToken: prepared.completionToken,
      ...body,
    }),
  });
}

export function BackupAdminAction({ demoMode, currentUser }: { demoMode: boolean; currentUser: BackupUser }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [factors, setFactors] = useState<AdminMfaFactor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState<BrowserBackupProgress | null>(null);
  const owner = currentUser.role === "owner";

  async function begin() {
    if (demoMode || !owner) return;
    setError("");
    setDone(false);
    setProgress(null);
    setCode("");
    const supabase = createClient();
    if (!supabase) {
      setError("O Supabase não está disponível nesta sessão.");
      setOpen(true);
      return;
    }
    const result = await supabase.auth.mfa.listFactors();
    const verified = ((result.data as { all?: AdminMfaFactor[] } | null)?.all ?? [])
      .filter((factor) => factor.factor_type === "totp" && factor.status === "verified");
    setFactors(verified);
    setFactorId(verified[0]?.id ?? "");
    if (result.error || !verified.length) setError("Nenhum autenticador confirmado foi encontrado nesta conta.");
    setOpen(true);
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setCode("");
    setProgress(null);
    setError("");
    setDone(false);
  }

  async function createBackup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError("Digite o código atual de seis números do aplicativo autenticador.");
      return;
    }
    setBusy(true);
    setDone(false);
    setError("");
    setProgress({ phase: "packing", current: 0, total: 1, label: "Validando o código e preparando o manifesto" });
    let prepared: PreparedResponse | null = null;
    try {
      const response = await fetch("/api/admin/backups/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ factorId, code }),
      });
      const payload = await response.json().catch(() => null) as (PreparedResponse & { error?: string }) | null;
      if (!response.ok || !payload) throw new Error(payload?.error || "Não foi possível preparar o backup.");
      prepared = payload;
      setCode("");
      const result = await createEncryptedBrowserBackup(prepared, setProgress);
      prepared.dataKey = "";
      const completion = await reportCompletion(prepared, {
        status: "verified",
        fileSha256: result.fileSha256,
        sizeBytes: result.sizeBytes,
      });
      if (!completion.ok) throw new Error("O arquivo foi verificado, mas o registro de segurança não foi concluído.");
      downloadBackupFile(result.blob, result.filename);
      setDone(true);
      window.dispatchEvent(new CustomEvent("admin:backup-complete"));
      toast({
        kind: "success",
        message: `Backup verificado: ${prepared.summary.rowCount} registros, ${prepared.summary.mediaCount} arquivos e ${formatBytes(result.sizeBytes)}.`,
        duration: 7000,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível gerar o backup.";
      setError(message);
      if (prepared) {
        prepared.dataKey = "";
        await reportCompletion(prepared, { status: "failed", errorMessage: message }).catch(() => null);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <article className="secure-backup-card">
        <DatabaseBackup />
        <h3>Backup completo</h3>
        <p>Gera um pacote criptografado com dados e mídias do Supabase, depois de confirmar seu código em duas etapas.</p>
        <button className="admin-button primary" type="button" disabled={demoMode || !owner} onClick={() => void begin()}>
          <ShieldCheck /> Criar backup agora
        </button>
        {!owner && <small>Disponível somente para o proprietário.</small>}
      </article>

      {open && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="backup-dialog-title">
          <button className="admin-modal-overlay" type="button" onClick={close} aria-label="Fechar backup" />
          <section className="admin-modal-panel small backup-mfa-modal">
            <header>
              <div><span>BACKUP PROTEGIDO</span><h2 id="backup-dialog-title">Confirmar e gerar backup</h2><small>{currentUser.email}</small></div>
              <button type="button" onClick={close} disabled={busy} aria-label="Fechar"><X /></button>
            </header>
            <form onSubmit={createBackup}>
              <div className="backup-security-note"><ShieldCheck /><div><strong>Confirmação obrigatória</strong><p>Um novo código do autenticador é exigido para cada backup. O pacote será criptografado antes do download.</p></div></div>
              {!busy && !done && factors.length > 1 && <label>Dispositivo autenticador<select value={factorId} onChange={(event) => { setFactorId(event.target.value); setCode(""); setError(""); }}>{factors.map((factor, index) => <option value={factor.id} key={factor.id}>{mfaFactorName(factor, index)}</option>)}</select></label>}
              {!busy && !done && <label>Código de segurança<div className="backup-code-field"><KeyRound /><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" autoFocus /></div></label>}
              {busy && progress && <div className="backup-progress" aria-live="polite"><div><LoaderCircle className="is-spinning" /><span><strong>{progress.label}</strong><small>Não feche esta janela durante a criação do arquivo.</small></span></div><progress value={progress.phase === "media" && progress.total ? progress.current : undefined} max={progress.phase === "media" && progress.total ? progress.total : undefined} /></div>}
              {done && <div className="backup-complete"><CheckCircle2 /><div><strong>Backup verificado e baixado</strong><p>Guarde o arquivo em um local externo e protegido.</p></div></div>}
              {error && <p className="security-mfa-error" role="alert">{error}</p>}
              <footer>
                <button className="admin-button" type="button" onClick={close} disabled={busy}>{done ? "Fechar" : "Cancelar"}</button>
                {!done && <button className="admin-button primary" disabled={busy || !factorId || code.length !== 6}><ShieldCheck /> {busy ? "Gerando..." : "Validar código e gerar"}</button>}
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
