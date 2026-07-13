import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    if (cookieStore.get("junior-demo-admin")?.value !== "1") redirect("/admin/login");
    return { id: "demo-admin", email: "admin@juniorimports.demo" };
  }

  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/admin/login");
  return { id: user.id, email: user.email ?? "" };
}
