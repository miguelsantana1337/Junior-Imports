import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPasswordChangeForm } from "@/components/admin/admin-password-change-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Trocar senha temporária" };

export default async function AdminChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/admin");
  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("active, must_change_password")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.active) redirect("/admin/login");

  const personalMode = (await searchParams).mode === "personal";
  const temporaryMode = profile.must_change_password || user.user_metadata?.must_change_password === true;
  if (!temporaryMode && !personalMode) {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    redirect(assurance.data?.currentLevel === "aal2" ? "/admin" : "/admin/mfa");
  }
  if (personalMode) {
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error || assurance.data?.currentLevel !== "aal2") redirect("/admin/mfa");
  }
  return <AdminPasswordChangeForm mode={personalMode ? "personal" : "temporary"} />;
}
