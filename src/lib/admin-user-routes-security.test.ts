import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("rotas de identidade administrativa", () => {
  it("não reutiliza identidades globais por coincidência de e-mail", () => {
    const users = source("src/app/api/admin/users/route.ts");
    const tenants = source("src/app/api/platform/tenants/route.ts");
    expect(users).toContain("if (existing) return NextResponse.json");
    expect(tenants).not.toContain("auth.admin.listUsers");
    expect(tenants).toContain("Use um e-mail que ainda não esteja cadastrado");
  });

  it("impede delegação superior e mudanças globais entre lojas", () => {
    const users = source("src/app/api/admin/users/route.ts");
    const password = source("src/app/api/admin/users/password/route.ts");
    expect(users).toContain("canDelegateAdminAccess");
    expect(users).toContain("canManageGlobalIdentity");
    expect(password).toContain("canManageGlobalIdentity");
    expect(password).toContain('select("tenant_id").eq("user_id", parsed.data.id)');
  });
});
