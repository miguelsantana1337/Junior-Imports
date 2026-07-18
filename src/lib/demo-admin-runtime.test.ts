import { describe, expect, it } from "vitest";
import { shouldAllowDemoAdmin } from "./demo-admin-runtime";

describe("modo demonstrativo administrativo", () => {
  it("fica disponível no desenvolvimento local sem Supabase", () => {
    expect(shouldAllowDemoAdmin({ supabaseConfigured: false, nodeEnv: "development", vercelEnv: undefined })).toBe(true);
  });

  it("fica disponível em preview, mas nunca na produção da Vercel", () => {
    expect(shouldAllowDemoAdmin({ supabaseConfigured: false, nodeEnv: "production", vercelEnv: "preview" })).toBe(true);
    expect(shouldAllowDemoAdmin({ supabaseConfigured: false, nodeEnv: "production", vercelEnv: "production" })).toBe(false);
  });

  it("não ativa o demo quando o Supabase está configurado", () => {
    expect(shouldAllowDemoAdmin({ supabaseConfigured: true, nodeEnv: "development", vercelEnv: undefined })).toBe(false);
  });
});
