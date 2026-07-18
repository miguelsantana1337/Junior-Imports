import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoAdminCredentials } from "@/lib/supabase/demo-credentials";
import { isDemoAdminAllowed } from "@/lib/demo-admin-runtime";
import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = { title: "Acesso administrativo" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const passwordStatus = (await searchParams).password;
  const notice = passwordStatus === "updated"
    ? "Senha alterada com sucesso. Entre novamente para confirmar sua identidade."
    : passwordStatus === "recovered"
      ? "Senha redefinida com sucesso. Entre com a nova senha; seu MFA continua protegendo a conta."
      : "";
  const demoMode = !isSupabaseConfigured();
  if (demoMode && !isDemoAdminAllowed()) {
    return <div className="admin-login-page"><section className="admin-login-card admin-configuration-error"><ShieldAlert /><span className="admin-badge">AMBIENTE PROTEGIDO</span><h1>Painel indisponível</h1><p>O modo demonstrativo é bloqueado em produção. Configure as variáveis do Supabase para liberar o acesso administrativo com autenticação real.</p><Link className="button button-primary button-full button-large" href="/">Voltar para a loja</Link></section></div>;
  }
  return <AdminLoginForm demoEmail={demoMode ? demoAdminCredentials.email : ""} demoPassword={demoMode ? demoAdminCredentials.password : ""} demoMode={demoMode} notice={notice} />;
}
