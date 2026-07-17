import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoAdminCredentials } from "@/lib/supabase/demo-credentials";

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
  return <AdminLoginForm demoEmail={demoMode ? demoAdminCredentials.email : ""} demoPassword={demoMode ? demoAdminCredentials.password : ""} demoMode={demoMode} notice={notice} />;
}
