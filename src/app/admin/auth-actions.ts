"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminLoginSchema } from "@/lib/validation";
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
    cookieStore.set("junior-demo-admin", "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
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
  redirect("/admin");
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete("junior-demo-admin");
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect("/admin/login");
}
