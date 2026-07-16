import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminRecoveredPasswordForm } from "@/components/admin/admin-recovered-password-form";
import {
  hasValidPasswordRecoveryProof,
  passwordRecoveryCookie,
} from "@/lib/password-recovery-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Criar nova senha" };

export default async function AdminResetPasswordPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  if (!supabase || !admin) redirect("/admin/forgot-password");

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/forgot-password");
  const proof = (await cookies()).get(passwordRecoveryCookie)?.value;
  if (!hasValidPasswordRecoveryProof(proof, user.id)) redirect("/admin/forgot-password");

  const { data: profile } = await admin.from("profiles").select("active").eq("id", user.id).maybeSingle();
  if (!profile?.active) redirect("/admin/forgot-password");

  return <AdminRecoveredPasswordForm />;
}
