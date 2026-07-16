"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminLoginSchema, adminPasswordChangeSchema } from "@/lib/validation";
import { platformRuntimeKeys } from "@/config/platform";
import { demoAdminCredentials, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function loginAction(_previous: { error: string }, formData: FormData) {
  const parsed = adminLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  if (!isSupabaseConfigured()) {
    if (parsed.data.email !== demoAdminCredentials.email || parsed.data.password !== demoAdminCredentials.password) {
      return { error: "Credenciais demonstrativas incorretas." };
    }
    const cookieStore = await cookies();
    cookieStore.set(platformRuntimeKeys.adminCookie, "1", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
    redirect("/admin");
  }

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado." };
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "E-mail ou senha inválidos." };
  const { data: profile } = await supabase.from("profiles").select("role, active, permissions").eq("id", data.user.id).maybeSingle();
  if (!profile?.active || !["owner", "manager", "editor", "support", "viewer", "admin"].includes(profile.role)) {
    await supabase.auth.signOut();
    return { error: "Este usuário não possui permissão administrativa." };
  }
  const { data: membership } = await supabase.from("tenant_members").select("tenant_id").eq("user_id", data.user.id).eq("active", true).limit(1).maybeSingle();
  if (membership?.tenant_id) {
    const { data: tenant } = await supabase.from("tenants").select("slug").eq("id", membership.tenant_id).maybeSingle();
    if (tenant?.slug) {
      const cookieStore = await cookies();
      cookieStore.set("saas-tenant", tenant.slug, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }
  }
  if (data.user.user_metadata?.must_change_password === true) redirect("/admin/change-password");
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  redirect(assurance.data?.currentLevel === "aal2" ? "/admin" : "/admin/mfa");
}

export async function changeTemporaryPasswordAction(_previous: { error: string }, formData: FormData) {
  if (!isSupabaseConfigured()) redirect("/admin");
  const parsed = adminPasswordChangeSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Revise a nova senha." };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não configurado." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { ...user.user_metadata, must_change_password: false },
  });
  if (error) return { error: "Não foi possível trocar a senha. Entre novamente e tente de novo." };
  redirect("/admin/mfa");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(platformRuntimeKeys.adminCookie);
  cookieStore.delete("saas-tenant");
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}
