import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607160008_password_recovery_otp.sql"),
  "utf8",
).toLowerCase();

describe("segurança da recuperação de senha", () => {
  it("adiciona limites separados para envio e verificação", () => {
    expect(migration).toContain("'password_reset'");
    expect(migration).toContain("'password_verify'");
  });

  it("mantém a função de rate limit restrita ao service role", () => {
    expect(migration).toContain("from public, anon, authenticated");
    expect(migration).toContain("to service_role");
  });
});
