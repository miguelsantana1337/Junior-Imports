import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("simplificação das áreas administrativas", () => {
  it("remove os blocos de prioridades e atividade recente do dashboard", () => {
    const dashboard = source("src/components/admin/dashboard-admin.tsx");
    expect(dashboard).not.toContain("Prioridades de hoje");
    expect(dashboard).not.toContain("Atividade recente");
  });

  it("remove tarefas e contatos da navegação e das rotas", () => {
    expect(source("src/components/admin/admin-shell.tsx")).not.toContain('href: "/admin/crm"');
    expect(source("src/app/admin/(panel)/[section]/page.tsx")).not.toContain("crm: CrmAdmin");
    expect(existsSync(resolve(process.cwd(), "src/components/admin/crm-admin.tsx"))).toBe(false);
    expect(source("public/admin-manifest.webmanifest")).not.toContain("/admin/crm");
    expect(source("src/components/admin/automation-studio.tsx")).not.toContain("Criar tarefa");
    expect(source("src/components/admin/whatsapp-assistant.tsx")).not.toContain("saveCustomerTask");
  });
});
