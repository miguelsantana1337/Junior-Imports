import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminMfaForm } from "@/components/admin/admin-mfa-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verificação de segurança" };

export default async function AdminMfaPage() {
  if (!isSupabaseConfigured()) redirect("/admin");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect("/admin/login");
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.data?.currentLevel === "aal2") redirect("/admin");
  return <AdminMfaForm />;
}
