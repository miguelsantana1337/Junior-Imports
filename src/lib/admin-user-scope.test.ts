import { describe, expect, it } from "vitest";
import { canDelegateAdminAccess, canManageGlobalIdentity } from "./admin-user-scope";

describe("isolamento do gerenciamento de usuários", () => {
  const actor = { role: "manager" as const, permissions: ["users", "orders"] as ("users" | "orders")[], isPlatformAdmin: false, tenantId: "store-a" };

  it("nega a criação e edição com permissões superiores às do gerente", () => {
    expect(canDelegateAdminAccess(actor, "manager", ["finance"])).toBe(false);
    expect(canDelegateAdminAccess(actor, "owner", [])).toBe(false);
    expect(canDelegateAdminAccess(actor, "support", ["orders"])).toBe(true);
  });

  it("não permite controlar identidades de outras lojas ou da plataforma", () => {
    expect(canManageGlobalIdentity(actor, { isPlatformAdmin: false, tenantIds: ["store-a", "store-b"] })).toBe(false);
    expect(canManageGlobalIdentity(actor, { isPlatformAdmin: true, tenantIds: ["store-a"] })).toBe(false);
    expect(canManageGlobalIdentity(actor, { isPlatformAdmin: false, tenantIds: [] })).toBe(false);
    expect(canManageGlobalIdentity(actor, { isPlatformAdmin: false, tenantIds: ["store-a"] })).toBe(true);
  });
});
