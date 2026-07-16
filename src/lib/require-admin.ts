import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { platformConfig, platformRuntimeKeys } from "@/config/platform";
import { createClient } from "@/lib/supabase/server";
import { allAdminPermissions, firstAllowedAdminPath, hasAdminPermission } from "@/lib/admin-permissions";
import type { AdminPermission, AdminRole } from "@/types/store";

export interface AdminSessionUser {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  permissions: AdminPermission[];
  tenantId: string;
  tenantSlug: string;
  isPlatformAdmin: boolean;
}

function isEmailPlatformAdmin(email: string) {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

export async function requireAdmin(requiredPermission?: AdminPermission): Promise<AdminSessionUser> {
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    if (cookieStore.get(platformRuntimeKeys.adminCookie)?.value !== "1") redirect("/admin/login");
    return { id: "00000000-0000-4000-8000-000000000001", email: platformConfig.demoAdmin.email, fullName: platformConfig.demoAdmin.fullName, role: "owner", permissions: allAdminPermissions, tenantId: "00000000-0000-4000-8000-000000000100", tenantSlug: platformConfig.clientId, isPlatformAdmin: true };
  }

  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  let { data: profile, error: profileError } = await supabase.from("profiles").select("role, permissions, active, full_name, email, is_platform_admin, must_change_password").eq("id", user.id).maybeSingle();
  if (profileError?.code === "42703") {
    const legacy = await supabase.from("profiles").select("role, permissions, active, full_name, email").eq("id", user.id).maybeSingle();
    profile = legacy.data ? { ...legacy.data, is_platform_admin: false, must_change_password: false } : null;
    profileError = legacy.error;
  }
  if (profileError) redirect("/admin/login");
  if (!profile?.active) redirect("/admin/login");
  if (profile.must_change_password || user.user_metadata?.must_change_password === true) {
    redirect("/admin/change-password");
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") redirect("/admin/mfa");
  const email = profile.email || user.email || "";
  const platformAdmin = Boolean(profile.is_platform_admin) || isEmailPlatformAdmin(email);
  const cookieStore = await cookies();
  const requestedTenantSlug = cookieStore.get("saas-tenant")?.value || platformConfig.clientId;
  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id, slug").eq("slug", requestedTenantSlug).maybeSingle();

  if (!tenantError && tenant) {
    const { data: membership } = await supabase.from("tenant_members").select("role, permissions, active").eq("tenant_id", tenant.id).eq("user_id", user.id).maybeSingle();
    if (!platformAdmin && !membership?.active) redirect("/admin/login");
    const role = (membership?.role ?? "owner") as AdminRole;
    const permissions = platformAdmin ? allAdminPermissions : (Array.isArray(membership?.permissions) ? membership.permissions as AdminPermission[] : []);
    if (requiredPermission && !hasAdminPermission(role, permissions, requiredPermission)) redirect(firstAllowedAdminPath(role, permissions));
    return { id: user.id, email, fullName: profile.full_name || user.user_metadata?.full_name || email.split("@")[0] || "Usuário", role, permissions, tenantId: tenant.id, tenantSlug: tenant.slug, isPlatformAdmin: platformAdmin };
  }

  const role = (profile.role === "admin" ? "owner" : profile.role) as AdminRole;
  const permissions = Array.isArray(profile.permissions) ? profile.permissions as AdminPermission[] : [];
  if (!(["owner", "manager", "editor", "support", "viewer"] as string[]).includes(role)) redirect("/admin/login");
  if (requiredPermission && !hasAdminPermission(role, permissions, requiredPermission)) {
    redirect(firstAllowedAdminPath(role, permissions));
  }
  return { id: user.id, email, fullName: profile.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuário", role, permissions, tenantId: "00000000-0000-4000-8000-000000000100", tenantSlug: platformConfig.clientId, isPlatformAdmin: platformAdmin };
}
