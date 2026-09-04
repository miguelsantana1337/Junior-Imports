import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { platformConfig, platformRuntimeKeys } from "@/config/platform";
import { createClient } from "@/lib/supabase/server";
import { demoAdminCredentials } from "@/lib/supabase/demo-credentials";
import { allAdminPermissions, firstAllowedAdminPath, hasAdminPermission } from "@/lib/admin-permissions";
import type { AdminPermission, AdminRole } from "@/types/store";
import { isDemoAdminAllowed } from "@/lib/demo-admin-runtime";

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

export async function requireAdmin(requiredPermission?: AdminPermission): Promise<AdminSessionUser> {
  if (!isSupabaseConfigured()) {
    if (!isDemoAdminAllowed()) redirect("/admin/login?configuration=missing");
    const cookieStore = await cookies();
    if (cookieStore.get(platformRuntimeKeys.adminCookie)?.value !== "1") redirect("/admin/login");
    return { id: "00000000-0000-4000-8000-000000000001", email: demoAdminCredentials.email, fullName: demoAdminCredentials.fullName, role: "owner", permissions: allAdminPermissions, tenantId: "00000000-0000-4000-8000-000000000100", tenantSlug: platformConfig.clientId, isPlatformAdmin: true };
  }

  const supabase = await createClient();
  if (!supabase) redirect("/admin/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const { data: profile, error: profileError } = await supabase.from("profiles").select("role, permissions, active, full_name, email, is_platform_admin, must_change_password").eq("id", user.id).maybeSingle();
  if (profileError) redirect("/admin/login");
  if (!profile?.active) redirect("/admin/login");
  if (profile.must_change_password || user.user_metadata?.must_change_password === true) {
    redirect("/admin/change-password");
  }
  const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance.error || assurance.data?.currentLevel !== "aal2") redirect("/admin/mfa");
  const email = profile.email || user.email || "";
  const platformAdmin = Boolean(profile.is_platform_admin);
  const cookieStore = await cookies();
  const requestedTenantSlug = cookieStore.get("saas-tenant")?.value || platformConfig.clientId;
  const { data: tenant, error: tenantError } = await supabase.from("tenants").select("id, slug, status").eq("slug", requestedTenantSlug).maybeSingle();

  if (!tenantError && tenant && ["active", "trial"].includes(tenant.status)) {
    const { data: membership, error: membershipError } = await supabase.from("tenant_members").select("role, permissions, active").eq("tenant_id", tenant.id).eq("user_id", user.id).maybeSingle();
    if (membershipError || (!platformAdmin && !membership?.active)) redirect("/admin/login");
    const role = (membership?.role ?? "owner") as AdminRole;
    const permissions = platformAdmin ? allAdminPermissions : (Array.isArray(membership?.permissions) ? membership.permissions as AdminPermission[] : []);
    if (requiredPermission && !hasAdminPermission(role, permissions, requiredPermission)) redirect(firstAllowedAdminPath(role, permissions));
    return { id: user.id, email, fullName: profile.full_name || user.user_metadata?.full_name || email.split("@")[0] || "Usuário", role, permissions, tenantId: tenant.id, tenantSlug: tenant.slug, isPlatformAdmin: platformAdmin };
  }

  redirect("/admin/login");
}
