import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminPasswordRecoveryForm } from "@/components/admin/admin-password-recovery-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Recuperar senha" };

export default async function AdminForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) redirect("/admin/login");
  const initialError = (await searchParams).error === "expired"
    ? "O link de recuperação é inválido ou expirou. Solicite um novo e-mail."
    : "";
  return <AdminPasswordRecoveryForm initialError={initialError} />;
}
