import { describe, expect, it } from "vitest";
import { shouldAllowDemoAdmin } from "./demo-admin-runtime";

describe("modo demonstrativo administrativo", () => {
  it("fica disponível no desenvolvimento local sem Supabase", () => {
    expect(shouldAllowDemoAdmin({ supabaseConfigured: false, nodeEnv: "development", vercelEnv: undefined })).toBe(true);
  });

  it("bloqueia o demo em qualquer ambiente hospedado", () => {
    expect(shouldAllowDemoAdmin({ supabaseConfigured: false, nodeEnv: "production", vercelEnv: "preview" })).toBe(false);
    expect(shouldAllowDemoAdmin({ supabaseConfigured: false, nodeEnv: "production", vercelEnv: "production" })).toBe(false);
  });

  it("não ativa o demo quando o Supabase está configurado", () => {
    expect(shouldAllowDemoAdmin({ supabaseConfigured: true, nodeEnv: "development", vercelEnv: undefined })).toBe(false);
  });
});
