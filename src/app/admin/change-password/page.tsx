import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPasswordChangeForm } from "@/components/admin/admin-password-change-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trocar senha temporária" };

export default async function AdminChangePasswordPage() {
  if (!isSupabaseConfigured()) redirect("/admin");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  if (user.user_metadata?.must_change_password !== true) {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    redirect(assurance.data?.currentLevel === "aal2" ? "/admin" : "/admin/mfa");
  }
  return <AdminPasswordChangeForm />;
}
