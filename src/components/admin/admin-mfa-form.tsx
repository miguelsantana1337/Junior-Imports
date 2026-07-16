"use client";

import { KeyRound, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type MfaMode = "loading" | "enroll" | "verify";

type ListedFactor = {
  id: string;
  status?: string;
  factor_type?: string;
};

export function AdminMfaForm() {
  const [mode, setMode] = useState<MfaMode>("loading");
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
      const factors = await supabase.auth.mfa.listFactors();
      if (!active) return;
      if (factors.error) {
        setError("Não foi possível carregar a verificação em duas etapas.");
        return;
      }
      const listed = ((factors.data as { totp?: ListedFactor[] } | null)?.totp ?? []);
      const verified = listed.find((factor) => factor.status === "verified");
      if (verified) {
        setFactorId(verified.id);
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
        friendlyName: "Junior Imports",
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
    window.location.assign("/admin");
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
