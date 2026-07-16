"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { changeTemporaryPasswordAction } from "@/app/admin/auth-actions";

export function AdminPasswordChangeForm({ mode }: { mode: "temporary" | "personal" }) {
  const [state, action, pending] = useActionState(changeTemporaryPasswordAction, { error: "" });
  const personal = mode === "personal";

  return (
    <main className="mfa-page">
      <form className="mfa-card password-change-card" action={action}>
        <input type="hidden" name="mode" value={mode} />
        <div className="mfa-icon"><KeyRound /></div>
        <span>{personal ? "SEGURANÇA DA CONTA" : "PRIMEIRO ACESSO"}</span>
        <h1>{personal ? "Alterar minha senha" : "Crie sua senha definitiva"}</h1>
        <p>{personal
          ? "Depois da alteração, todas as sessões serão encerradas e você entrará novamente com a nova senha."
          : "A senha temporária não poderá ser usada para entrar no painel. Depois desta etapa, você configurará o autenticador."}</p>
        <label>
          Nova senha
          <input name="password" type="password" minLength={12} maxLength={72} required autoComplete="new-password" />
          <small>Use 12 ou mais caracteres, com maiúscula, minúscula, número e símbolo.</small>
        </label>
        <label>
          Confirmar nova senha
          <input name="confirmation" type="password" minLength={12} maxLength={72} required autoComplete="new-password" />
        </label>
        {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
        <button className="admin-button primary" disabled={pending}>{pending ? "Protegendo conta..." : personal ? "Alterar senha" : "Salvar senha e continuar"}</button>
      </form>
    </main>
  );
}
