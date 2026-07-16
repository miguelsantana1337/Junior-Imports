"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { changeTemporaryPasswordAction } from "@/app/admin/auth-actions";

export function AdminPasswordChangeForm() {
  const [state, action, pending] = useActionState(changeTemporaryPasswordAction, { error: "" });

  return (
    <main className="mfa-page">
      <form className="mfa-card password-change-card" action={action}>
        <div className="mfa-icon"><KeyRound /></div>
        <span>PRIMEIRO ACESSO</span>
        <h1>Crie sua senha definitiva</h1>
        <p>A senha temporária não poderá ser usada para entrar no painel. Depois desta etapa, você configurará o autenticador.</p>
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
        <button className="admin-button primary" disabled={pending}>{pending ? "Protegendo conta..." : "Salvar senha e continuar"}</button>
      </form>
    </main>
  );
}
