import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { demoAdminCredentials, isSupabaseConfigured } from "@/lib/supabase/config";

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
  return <AdminLoginForm demoEmail={demoAdminCredentials.email} demoPassword={demoAdminCredentials.password} demoMode={!isSupabaseConfigured()} notice={notice} />;
}
