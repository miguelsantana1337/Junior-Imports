import type { Metadata } from "next";
import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { demoAdminCredentials, isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Acesso administrativo" };

export default function AdminLoginPage() {
  return <AdminLoginForm demoEmail={demoAdminCredentials.email} demoPassword={demoAdminCredentials.password} demoMode={!isSupabaseConfigured()} />;
}
