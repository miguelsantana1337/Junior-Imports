"use client";

import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { mfaFactorName, type AdminMfaFactor } from "@/lib/admin-mfa";
import { createClient } from "@/lib/supabase/client";

type MfaMode = "loading" | "enroll" | "verify";

export function AdminMfaForm() {
  const [mode, setMode] = useState<MfaMode>("loading");
  const [factors, setFactors] = useState<AdminMfaFactor[]>([]);
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function prepare() {
      const supabase = createClient();
      if (!supabase) return;
      const factorResponse = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factorResponse.error) {
        setError("Não foi possível carregar a verificação em duas etapas.");
        return;
      }
      const listed = ((factorResponse.data as { all?: AdminMfaFactor[]; totp?: AdminMfaFactor[] } | null)?.all
        ?? (factorResponse.data as { totp?: AdminMfaFactor[] } | null)?.totp
        ?? []).filter((factor) => factor.factor_type === "totp");
      const verified = listed.filter((factor) => factor.status === "verified");
      if (verified.length) {
        setFactors(verified);
        setFactorId(verified[0].id);
        setMode("verify");
        return;
      }

      await Promise.all(
        listed
          .filter((factor) => factor.status !== "verified")
          .map((factor) => supabase.auth.mfa.unenroll({ factorId: factor.id })),
      );
      const enrolled = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Dispositivo principal",
        issuer: "Junior Imports",
      });
      if (!active) return;
      if (enrolled.error || !enrolled.data) {
        setError("Não foi possível iniciar o autenticador. Verifique a configuração do Supabase.");
        return;
      }
      setFactorId(enrolled.data.id);
      setQrCode(enrolled.data.totp.qr_code);
      setSecret(enrolled.data.totp.secret);
      setMode("enroll");
    }
    void prepare();
    return () => {
      active = false;
    };
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Digite o código de seis números do aplicativo autenticador.");
      return;
    }
    const supabase = createClient();
    if (!supabase || !factorId) return;
    setBusy(true);
    setError("");
    const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (result.error) {
      setError("Código inválido ou expirado. Aguarde o próximo código e tente novamente.");
      setBusy(false);
      return;
    }
    const requestedPath = new URLSearchParams(window.location.search).get("returnTo");
    const destination = requestedPath?.startsWith("/admin/") && !requestedPath.startsWith("//")
      ? requestedPath
      : "/admin";
    window.location.assign(destination);
  }

  async function signOut() {
    const supabase = createClient();
    if (supabase) await supabase.auth.signOut();
    window.location.assign("/admin/login");
  }

  return (
    <main className="mfa-page">
      <section className="mfa-card">
        <div className="mfa-icon"><ShieldCheck /></div>
        <span>PROTEÇÃO ADMINISTRATIVA</span>
        <h1>Verificação em duas etapas</h1>
        {mode === "loading" && !error && <p>Preparando a proteção da sua conta...</p>}
        {mode === "enroll" && (
          <>
            <p>Escaneie o QR Code no Google Authenticator, Microsoft Authenticator, 1Password ou aplicativo compatível.</p>
            {/* O QR Code é um data URL gerado pelo Supabase e não pode passar pelo otimizador de imagens. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrCode && <img className="mfa-qr" src={qrCode} alt="QR Code para configurar o autenticador" />}
            {secret && <div className="mfa-secret"><small>Chave manual</small><code>{secret}</code></div>}
          </>
        )}
        {mode === "verify" && <p>Digite o código atual do seu aplicativo autenticador para acessar o painel.</p>}
        {mode !== "loading" && (
          <form onSubmit={verify}>
            {mode === "verify" && factors.length > 1 && (
              <label>
                Dispositivo autenticador
                <select
                  value={factorId}
                  onChange={(event) => {
                    setFactorId(event.target.value);
                    setCode("");
                    setError("");
                  }}
                  aria-label="Dispositivo autenticador"
                >
                  {factors.map((factor, index) => (
                    <option value={factor.id} key={factor.id}>{mfaFactorName(factor, index)}</option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Código de segurança
              <div className="mfa-code-field"><KeyRound /><input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></div>
            </label>
            {error && <p className="admin-form-error" role="alert">{error}</p>}
            <button className="admin-button primary" disabled={busy}>{busy ? "Verificando..." : "Confirmar e acessar"}</button>
          </form>
        )}
        {error && mode === "loading" && <p className="admin-form-error" role="alert">{error}</p>}
        <button className="mfa-signout" type="button" onClick={signOut}><LogOut /> Sair desta conta</button>
      </section>
    </main>
  );
}
