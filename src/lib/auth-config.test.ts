import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

describe("configuração de autenticação", () => {
  it("mantém login por e-mail ativo sem liberar cadastro público", () => {
    const globalAuth = config.match(/\[auth\]([\s\S]*?)(?=\n\[)/)?.[1] ?? "";
    const emailAuth = config.match(/\[auth\.email\]([\s\S]*?)(?=\n\[)/)?.[1] ?? "";

    expect(globalAuth).toContain("enable_signup = false");
    expect(emailAuth).toContain("enable_signup = true");
  });
});
