import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { allAdminPermissions, firstAllowedAdminPath, hasAdminPermission } from "@/lib/admin-permissions";
import type { AdminPermission, AdminRole } from "@/types/store";

export interface AdminSessionUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

export async function requireAdmin(requiredPermission?: AdminPermission): Promise<AdminSessionUser> {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    if (cookieStore.get("junior-demo-admin")?.value !== "1") redirect("/admin/login");
    return { id: "00000000-0000-4000-8000-000000000001", email: "admin@juniorimports.demo", fullName: "Administrador Demo", role: "owner", permissions: allAdminPermissions };
  }

  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile } = await supabase.from("profiles").select("role, permissions, active, full_name, email").eq("id", user.id).maybeSingle();
  if (!profile?.active) redirect("/admin/login");
  const role = (profile.role === "admin" ? "owner" : profile.role) as AdminRole;
  const permissions = Array.isArray(profile.permissions) ? profile.permissions as AdminPermission[] : [];
  if (!(["owner", "manager", "editor", "support", "viewer"] as string[]).includes(role)) redirect("/admin/login");
  if (requiredPermission && !hasAdminPermission(role, permissions, requiredPermission)) {
    redirect(firstAllowedAdminPath(role, permissions));
  }
  return { id: user.id, email: profile.email || user.email || "", fullName: profile.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário", role, permissions };
}
