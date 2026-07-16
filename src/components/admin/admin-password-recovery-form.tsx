"use client";

import { KeyRound, Mail, RotateCcw } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

type RecoveryStep = "email" | "code";

async function postRecovery(path: string, payload: Record<string, string>) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json().catch(() => null) as {
    error?: string;
    message?: string;
    redirectTo?: string;
  } | null;
  if (!response.ok) throw new Error(result?.error || "Não foi possível concluir a solicitação.");
  return result;
}

export function AdminPasswordRecoveryForm({ initialError = "" }: { initialError?: string }) {
  const [step, setStep] = useState<RecoveryStep>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await postRecovery("/api/auth/password-recovery/request", { email });
      setMessage(result?.message || "Se o cadastro estiver ativo, o código será enviado por e-mail.");
      setStep("code");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível solicitar o código.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await postRecovery("/api/auth/password-recovery/verify", { email, code });
      window.location.assign(result?.redirectTo || "/admin/reset-password");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Não foi possível validar o código.");
    } finally {
      setPending(false);
    }
  }

  async function resendCode() {
    setPending(true);
    setError("");
    try {
      const result = await postRecovery("/api/auth/password-recovery/request", { email });
      setCode("");
      setMessage(result?.message || "Se o cadastro estiver ativo, um novo código será enviado.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível reenviar o código.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mfa-page">
      <form className="mfa-card password-change-card" onSubmit={step === "email" ? requestCode : verifyCode}>
        <div className="mfa-icon">{step === "email" ? <Mail /> : <KeyRound />}</div>
        <span>RECUPERAÇÃO DE ACESSO</span>
        <h1>{step === "email" ? "Esqueceu sua senha?" : "Informe o código"}</h1>
        <p>{step === "email"
          ? "Digite o e-mail cadastrado no painel. Se a conta estiver ativa, enviaremos um código de 6 dígitos."
          : <>Enviamos as instruções para <strong>{email}</strong>. Digite o código recebido ou abra o link seguro apresentado no e-mail.</>}</p>

        {step === "email" ? (
          <label>
            E-mail cadastrado
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              name="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
            />
          </label>
        ) : (
          <label>
            Código de 6 dígitos
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              name="code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              minLength={6}
              maxLength={6}
              required
              autoComplete="one-time-code"
              autoFocus
              className="password-recovery-code"
            />
          </label>
        )}

        {message && <p className="password-recovery-message" role="status">{message}</p>}
        {error && <p className="admin-form-error" role="alert">{error}</p>}
        <button className="admin-button primary" disabled={pending}>
          {pending ? "Aguarde..." : step === "email" ? "Enviar código" : "Validar código"}
        </button>

        {step === "code" && (
          <div className="password-recovery-actions">
            <button type="button" className="mfa-signout" onClick={resendCode} disabled={pending}>
              <RotateCcw /> Reenviar código
            </button>
            <button
              type="button"
              className="mfa-signout"
              onClick={() => {
                setStep("email");
                setCode("");
                setMessage("");
                setError("");
              }}
            >
              Alterar e-mail
            </button>
          </div>
        )}
        <Link className="mfa-signout" href="/admin/login">Voltar para o login</Link>
      </form>
    </main>
  );
}
