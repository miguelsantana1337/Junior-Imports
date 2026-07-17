import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const platformConfig = readFileSync(
  resolve(process.cwd(), "src/config/platform.ts"),
  "utf8",
);
const serverCredentials = readFileSync(
  resolve(process.cwd(), "src/lib/supabase/demo-credentials.ts"),
  "utf8",
);

describe("credenciais demonstrativas", () => {
  it("não expõe a senha em configuração NEXT_PUBLIC", () => {
    expect(platformConfig).not.toContain("NEXT_PUBLIC_DEMO_ADMIN_PASSWORD");
    expect(serverCredentials).not.toContain("NEXT_PUBLIC_DEMO_ADMIN_PASSWORD");
  });

  it("mantém a leitura da senha em módulo exclusivo do servidor", () => {
    expect(serverCredentials).toContain('import "server-only"');
    expect(serverCredentials).toContain("process.env.DEMO_ADMIN_PASSWORD");
  });
});
