"use client";

import {
  IconAlertTriangle,
  IconCheck,
  IconDeviceMobile,
  IconKey,
  IconLock,
  IconPlus,
  IconRefresh,
  IconShieldCheck,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminPanel } from "@/components/admin/admin-ui";
import { useAdminData } from "@/components/admin/admin-data-provider";
import { useToast } from "@/components/providers/toast-provider";
import {
  canRemoveMfaFactor,
  mfaFactorName,
  shortMfaFactorId,
  type AdminMfaFactor,
  validateMfaFactorName,
} from "@/lib/admin-mfa";
import { createClient } from "@/lib/supabase/client";

type Enrollment = {
  factorId: string;
  friendlyName: string;
  qrCode: string;
  secret: string;
};

function formatSecurityDate(value?: string) {
  if (!value) return "Ainda não registrado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

async function recordMfaAudit(
  action: "enroll" | "remove",
  factor: { id: string; friendlyName: string },
) {
  try {
    const response = await fetch("/api/admin/security/mfa-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        factorId: factor.id,
        friendlyName: factor.friendlyName,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function SecurityMfaAdmin() {
  const { currentUser, demoMode } = useAdminData();
  const toast = useToast();
  const [factors, setFactors] = useState<AdminMfaFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [newFactorName, setNewFactorName] = useState("");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [enrollmentCode, setEnrollmentCode] = useState("");
  const [factorToRemove, setFactorToRemove] = useState<AdminMfaFactor | null>(null);
  const [removalProofFactorId, setRemovalProofFactorId] = useState("");
  const [removalCode, setRemovalCode] = useState("");

  const verifiedFactors = useMemo(
    () => factors.filter((factor) => factor.factor_type === "totp" && factor.status === "verified"),
    [factors],
  );
  const pendingFactors = useMemo(
    () => factors.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified"),
    [factors],
  );

  const loadFactors = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) {
      setFactors([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError("Não foi possível carregar os autenticadores. Atualize a página e tente novamente.");
      setLoading(false);
      return;
    }
    const all = ((data as { all?: AdminMfaFactor[] } | null)?.all ?? [])
      .filter((factor) => factor.factor_type === "totp")
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
    setFactors(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadFactors();
  }, [loadFactors]);

  async function beginEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedName = validateMfaFactorName(newFactorName, factors);
    if (parsedName.error) {
      setError(parsedName.error);
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assurance.error || assurance.data.currentLevel !== "aal2") {
        window.location.assign("/admin/mfa?returnTo=/admin/security");
        return;
      }
      const result = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: parsedName.value,
        issuer: "Junior Imports",
      });
      if (result.error || !result.data) {
        setError("Não foi possível gerar o novo autenticador. Verifique o nome e tente novamente.");
        return;
      }
      setEnrollment({
        factorId: result.data.id,
        friendlyName: parsedName.value,
        qrCode: result.data.totp.qr_code,
        secret: result.data.totp.secret,
      });
      setEnrollmentCode("");
      setNewFactorName("");
    } finally {
      setBusy(false);
    }
  }

  async function cancelEnrollment() {
    if (!enrollment) return;
    const current = enrollment;
    setBusy(true);
    const supabase = createClient();
    if (supabase) await supabase.auth.mfa.unenroll({ factorId: current.factorId });
    setEnrollment(null);
    setEnrollmentCode("");
    setBusy(false);
    await loadFactors();
  }

  async function verifyEnrollment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment || !/^\d{6}$/.test(enrollmentCode)) {
      setError("Digite o código de seis números exibido no celular novo.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const result = await supabase.auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: enrollmentCode,
    });
    if (result.error) {
      setError("O código não foi aceito. Aguarde o próximo código do celular novo e tente novamente.");
      setBusy(false);
      return;
    }
    const auditRecorded = await recordMfaAudit("enroll", {
      id: enrollment.factorId,
      friendlyName: enrollment.friendlyName,
    });
    setEnrollment(null);
    setEnrollmentCode("");
    await loadFactors();
    setBusy(false);
    toast({
      kind: auditRecorded ? "success" : "info",
      message: auditRecorded
        ? "Novo autenticador confirmado. Teste o acesso nele antes de remover o antigo."
        : "Novo autenticador confirmado, mas o registro de auditoria precisa ser revisado.",
      duration: 6200,
    });
  }

  async function cancelPendingFactor(factor: AdminMfaFactor) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const result = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    if (result.error) {
      setError("Não foi possível cancelar essa configuração pendente.");
    } else {
      await loadFactors();
      toast({ kind: "info", message: "Configuração pendente cancelada." });
    }
    setBusy(false);
  }

  async function removeFactor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorToRemove || !canRemoveMfaFactor(factors, factorToRemove.id)) {
      setError("Confirme outro autenticador antes de remover este dispositivo.");
      return;
    }
    if (!/^\d{6}$/.test(removalCode)) {
      setError("Digite o código atual de um autenticador que permanecerá ativo.");
      return;
    }
    const proofFactor = verifiedFactors.find(
      (factor) => factor.id === removalProofFactorId && factor.id !== factorToRemove.id,
    );
    if (!proofFactor) {
      setError("Escolha um autenticador confirmado que permanecerá ativo.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const proof = await supabase.auth.mfa.challengeAndVerify({
      factorId: proofFactor.id,
      code: removalCode,
    });
    if (proof.error) {
      setError("Código inválido. Use o código atual do dispositivo que permanecerá ativo.");
      setBusy(false);
      return;
    }
    const removal = await supabase.auth.mfa.unenroll({ factorId: factorToRemove.id });
    if (removal.error) {
      setError("Não foi possível remover o autenticador. Entre novamente e repita a operação.");
      setBusy(false);
      return;
    }
    const removed = factorToRemove;
    const auditRecorded = await recordMfaAudit("remove", {
      id: removed.id,
      friendlyName: mfaFactorName(removed),
    });
    setFactorToRemove(null);
    setRemovalProofFactorId("");
    setRemovalCode("");
    await loadFactors();
    setBusy(false);
    toast({
      kind: auditRecorded ? "success" : "info",
      message: auditRecorded
        ? `${mfaFactorName(removed)} foi removido com segurança.`
        : "Autenticador removido, mas o registro de auditoria precisa ser revisado.",
    });
  }

  return (
    <div className="security-mfa-admin">
      <section className="security-mfa-hero">
        <div className="security-mfa-hero-icon"><IconShieldCheck /></div>
        <div>
          <span>SEGURANÇA DA CONTA</span>
          <h2>Seus acessos em duas etapas, sob controle.</h2>
          <p>Cadastre primeiro o celular do Júnior, confirme o código e teste o login. O autenticador antigo permanece válido até ser removido manualmente.</p>
        </div>
        <div className="security-mfa-hero-status">
          <IconLock />
          <div>
            <strong>
              {loading
                ? "Verificando proteção"
                : `${verifiedFactors.length || (demoMode ? 1 : 0)} ativo${verifiedFactors.length === 1 || (demoMode && verifiedFactors.length === 0) ? "" : "s"}`}
            </strong>
            <small>{currentUser.email}</small>
          </div>
        </div>
      </section>

      <section className="security-mfa-steps" aria-label="Etapas para trocar o autenticador">
        <article><span>1</span><div><strong>Cadastre o celular novo</strong><small>Use um nome claro, como “Júnior — principal”.</small></div></article>
        <article><span>2</span><div><strong>Confirme e teste o acesso</strong><small>O novo celular precisa gerar um código válido.</small></div></article>
        <article><span>3</span><div><strong>Remova o celular antigo</strong><small>A exclusão só é liberada depois do segundo fator ativo.</small></div></article>
      </section>

      <AdminPanel
        title="Autenticadores cadastrados"
        description="Cada dispositivo tem um segredo próprio. QR Code e chave manual nunca são salvos no painel."
        action={<button className="admin-button" type="button" onClick={() => void loadFactors()} disabled={loading || busy}><IconRefresh /> Atualizar</button>}
      >
        <div className="security-mfa-panel-body">
          {error && <p className="security-mfa-error" role="alert"><IconAlertTriangle /> {error}</p>}
          {loading && <div className="security-mfa-loading"><span /><span /><span /></div>}

          {!loading && verifiedFactors.length > 0 && (
            <div className="security-mfa-device-list">
              {verifiedFactors.map((factor, index) => (
                <article className="security-mfa-device" key={factor.id}>
                  <div className="security-mfa-device-icon"><IconDeviceMobile /></div>
                  <div className="security-mfa-device-copy">
                    <div><strong>{mfaFactorName(factor, index)}</strong><span><IconCheck /> Ativo</span></div>
                    <small>Cadastrado em {formatSecurityDate(factor.created_at)} · última verificação {formatSecurityDate(factor.last_challenged_at)}</small>
                    <code>{shortMfaFactorId(factor.id)}</code>
                  </div>
                  <button
                    className="admin-button danger"
                    type="button"
                    disabled={!canRemoveMfaFactor(factors, factor.id) || busy}
                    onClick={() => {
                      setError("");
                      setRemovalCode("");
                      setRemovalProofFactorId(
                        verifiedFactors.find((candidate) => candidate.id !== factor.id)?.id ?? "",
                      );
                      setFactorToRemove(factor);
                    }}
                    title={canRemoveMfaFactor(factors, factor.id) ? "Remover autenticador" : "Cadastre outro autenticador antes de remover este"}
                  >
                    <IconTrash /> Remover
                  </button>
                </article>
              ))}
            </div>
          )}

          {!loading && !verifiedFactors.length && (
            <div className="security-mfa-empty">
              <IconKey />
              <strong>{demoMode ? "Gerenciamento disponível com o Supabase conectado" : "Nenhum autenticador confirmado"}</strong>
              <p>{demoMode ? "No ambiente real, os dispositivos verificados aparecerão aqui." : "Cadastre um dispositivo para manter a conta protegida."}</p>
            </div>
          )}

          {!loading && pendingFactors.length > 0 && (
            <div className="security-mfa-pending">
              <strong>Configurações pendentes</strong>
              {pendingFactors.map((factor, index) => (
                <div key={factor.id}>
                  <span>{mfaFactorName(factor, index)} · iniciado em {formatSecurityDate(factor.created_at)}</span>
                  <button type="button" onClick={() => void cancelPendingFactor(factor)} disabled={busy}>Cancelar</button>
                </div>
              ))}
            </div>
          )}

          <form className="security-mfa-add" onSubmit={beginEnrollment}>
            <label>
              Nome do novo dispositivo
              <input
                value={newFactorName}
                onChange={(event) => setNewFactorName(event.target.value)}
                placeholder="Ex.: Júnior — celular principal"
                maxLength={50}
                disabled={demoMode || busy || Boolean(enrollment) || factors.length >= 10}
              />
              <small>Use um nome que permita reconhecer quem controla o aparelho.</small>
            </label>
            <button className="admin-button primary" disabled={demoMode || busy || Boolean(enrollment) || factors.length >= 10}>
              <IconPlus /> Adicionar autenticador
            </button>
          </form>
        </div>
      </AdminPanel>

      <section className="security-mfa-recovery-note">
        <IconAlertTriangle />
        <div>
          <strong>Não existem códigos de recuperação automáticos.</strong>
          <p>Mantenha pelo menos dois autenticadores sob controle do Júnior — principal e reserva. Nunca envie QR Code ou chave secreta por WhatsApp, e-mail ou captura de tela.</p>
        </div>
      </section>

      {enrollment && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="mfa-enrollment-title">
          <button className="admin-modal-overlay" type="button" onClick={() => void cancelEnrollment()} aria-label="Cancelar novo autenticador" />
          <section className="admin-modal-panel small security-mfa-modal">
            <header>
              <div><span>NOVO AUTENTICADOR</span><h2 id="mfa-enrollment-title">{enrollment.friendlyName}</h2><small>Escaneie presencialmente no celular do Júnior.</small></div>
              <button type="button" onClick={() => void cancelEnrollment()} aria-label="Fechar"><IconX /></button>
            </header>
            <form onSubmit={verifyEnrollment}>
              <div className="security-mfa-qr">
                {/* O QR Code é gerado pelo Supabase e mantido apenas na memória desta tela. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={enrollment.qrCode} alt="QR Code para cadastrar o novo autenticador" />
              </div>
              <div className="security-mfa-secret">
                <span>Chave manual</span>
                <code>{enrollment.secret}</code>
                <small>Não copie para mensagens nem salve em capturas de tela.</small>
              </div>
              <label>
                Código exibido no celular novo
                <input
                  value={enrollmentCode}
                  onChange={(event) => setEnrollmentCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </label>
              {error && <p className="security-mfa-error" role="alert"><IconAlertTriangle /> {error}</p>}
              <footer>
                <button className="admin-button" type="button" onClick={() => void cancelEnrollment()} disabled={busy}>Cancelar</button>
                <button className="admin-button primary" disabled={busy}><IconShieldCheck /> {busy ? "Confirmando..." : "Confirmar celular novo"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {factorToRemove && (
        <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="mfa-removal-title">
          <button className="admin-modal-overlay" type="button" onClick={() => setFactorToRemove(null)} aria-label="Cancelar remoção" />
          <section className="admin-modal-panel small security-mfa-modal">
            <header>
              <div><span>CONFIRMAÇÃO DE SEGURANÇA</span><h2 id="mfa-removal-title">Remover {mfaFactorName(factorToRemove)}?</h2><small>O dispositivo perderá acesso aos códigos desta conta.</small></div>
              <button type="button" onClick={() => setFactorToRemove(null)} aria-label="Fechar"><IconX /></button>
            </header>
            <form onSubmit={removeFactor}>
              <div className="security-mfa-removal-warning"><IconAlertTriangle /><p>Confirme a operação com um código do dispositivo que continuará ativo. Assim, mesmo um aparelho perdido pode ser revogado sem bloquear a conta.</p></div>
              <label>
                Autenticador que permanecerá ativo
                <select
                  value={removalProofFactorId}
                  onChange={(event) => {
                    setRemovalProofFactorId(event.target.value);
                    setRemovalCode("");
                    setError("");
                  }}
                >
                  {verifiedFactors.filter((factor) => factor.id !== factorToRemove.id).map((factor, index) => (
                    <option value={factor.id} key={factor.id}>{mfaFactorName(factor, index)}</option>
                  ))}
                </select>
              </label>
              <label>
                Código do dispositivo que permanecerá ativo
                <input
                  value={removalCode}
                  onChange={(event) => setRemovalCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  autoFocus
                />
              </label>
              {error && <p className="security-mfa-error" role="alert"><IconAlertTriangle /> {error}</p>}
              <footer>
                <button className="admin-button" type="button" onClick={() => setFactorToRemove(null)} disabled={busy}>Manter dispositivo</button>
                <button className="admin-button confirm-danger" disabled={busy}><IconTrash /> {busy ? "Removendo..." : "Confirmar remoção"}</button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
