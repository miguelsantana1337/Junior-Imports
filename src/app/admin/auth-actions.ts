"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminLoginSchema } from "@/lib/validation";
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
    cookieStore.set(platformRuntimeKeys.adminCookie, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
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
      cookieStore.set("saas-tenant", tenant.slug, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
    }
  }
  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(platformRuntimeKeys.adminCookie);
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}
