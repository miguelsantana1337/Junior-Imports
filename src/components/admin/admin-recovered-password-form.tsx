"use client";

import { ShieldCheck } from "lucide-react";
import { useActionState } from "react";
import { completeRecoveredPasswordAction } from "@/app/admin/auth-actions";

export function AdminRecoveredPasswordForm() {
  const [state, action, pending] = useActionState(completeRecoveredPasswordAction, { error: "" });

  return (
    <main className="mfa-page">
      <form className="mfa-card password-change-card" action={action}>
        <div className="mfa-icon"><ShieldCheck /></div>
        <span>ÚLTIMA ETAPA</span>
        <h1>Crie uma nova senha</h1>
        <p>Use uma senha exclusiva. Depois da alteração, todas as sessões abertas serão encerradas por segurança.</p>
        <label>
          Nova senha
          <input name="password" type="password" minLength={12} maxLength={72} required autoComplete="new-password" autoFocus />
          <small>Use 12 ou mais caracteres, com maiúscula, minúscula, número e símbolo.</small>
        </label>
        <label>
          Confirmar nova senha
          <input name="confirmation" type="password" minLength={12} maxLength={72} required autoComplete="new-password" />
        </label>
        {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
        <button className="admin-button primary" disabled={pending}>
          {pending ? "Alterando senha..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
