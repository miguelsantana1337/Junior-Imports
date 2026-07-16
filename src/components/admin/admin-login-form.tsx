"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/admin/auth-actions";

export function AdminLoginForm({ demoEmail, demoPassword, demoMode, notice = "" }: { demoEmail: string; demoPassword: string; demoMode: boolean; notice?: string }) {
  const [state, action, pending] = useActionState(loginAction, { error: "" });
  return (
    <div className="admin-login-page">
      <form className="admin-login-card" action={action}>
        <span className="admin-badge">PAINEL NEXT</span>
        <h1>Administracao da loja</h1>
        <p>{demoMode ? "Use as credenciais abaixo para testar o painel local." : "Entre com o administrador cadastrado no Supabase Auth."}</p>
        <label>E-mail<input name="email" type="email" required defaultValue={demoMode ? demoEmail : ""} autoComplete="email" /></label>
        <label>
          <span className="admin-login-label-row">
            Senha
            {!demoMode && <Link href="/admin/forgot-password">Esqueci a senha</Link>}
          </span>
          <input name="password" type="password" required defaultValue={demoMode ? demoPassword : ""} autoComplete="current-password" />
        </label>
        {demoMode && <div className="demo-credentials"><strong>Acesso demonstrativo</strong><span>{demoEmail}</span><span>{demoPassword}</span></div>}
        {notice && <p className="admin-data-message" role="status">{notice}</p>}
        {state.error && <p className="admin-form-error" role="alert">{state.error}</p>}
        <button className="button button-primary button-full button-large" disabled={pending}><LockKeyhole /> {pending ? "Entrando..." : "Entrar"}</button>
        <Link className="text-button" href="/">Voltar para a loja</Link>
      </form>
    </div>
  );
}
