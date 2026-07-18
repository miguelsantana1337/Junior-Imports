import { describe, expect, it } from "vitest";
import { adminRolePermissions, firstAllowedAdminPath, hasAdminPermission } from "./admin-permissions";

describe("permissoes administrativas", () => {
  it("proprietario sempre possui acesso completo", () => {
    expect(hasAdminPermission("owner", [], "users")).toBe(true);
  });

  it("limita atendimento aos modulos do cargo", () => {
    const permissions = adminRolePermissions.support;
    expect(hasAdminPermission("support", permissions, "orders")).toBe(true);
    expect(hasAdminPermission("support", permissions, "settings")).toBe(false);
  });

  it("direciona para a primeira area permitida", () => {
    expect(firstAllowedAdminPath("support", ["orders"])).toBe("/admin/orders");
  });

  it("libera a central de relatórios somente para quem recebeu a permissão", () => {
    expect(hasAdminPermission("manager", adminRolePermissions.manager, "reports")).toBe(true);
    expect(hasAdminPermission("viewer", adminRolePermissions.viewer, "reports")).toBe(false);
  });
});
