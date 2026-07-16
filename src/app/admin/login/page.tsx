import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { demoAdminCredentials, isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Acesso administrativo" };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ password?: string }>;
}) {
  const notice = (await searchParams).password === "updated"
    ? "Senha alterada com sucesso. Entre novamente para confirmar sua identidade."
    : "";
  return <AdminLoginForm demoEmail={demoAdminCredentials.email} demoPassword={demoAdminCredentials.password} demoMode={!isSupabaseConfigured()} notice={notice} />;
}
