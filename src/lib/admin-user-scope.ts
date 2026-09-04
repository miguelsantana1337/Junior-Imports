import type { AdminSessionUser } from "@/lib/require-admin";
import type { AdminPermission, AdminRole } from "@/types/store";

export function canDelegateAdminAccess(
  actor: Pick<AdminSessionUser, "role" | "permissions" | "isPlatformAdmin">,
  role: AdminRole,
  permissions: AdminPermission[],
) {
  return actor.isPlatformAdmin || actor.role === "owner"
    || (role !== "owner" && permissions.every((permission) => actor.permissions.includes(permission)));
}

export function canManageGlobalIdentity(
  actor: Pick<AdminSessionUser, "tenantId" | "isPlatformAdmin">,
  target: { isPlatformAdmin: boolean; tenantIds: string[] },
) {
  return actor.isPlatformAdmin || (!target.isPlatformAdmin
    && target.tenantIds.length > 0
    && target.tenantIds.every((tenantId) => tenantId === actor.tenantId));
}
