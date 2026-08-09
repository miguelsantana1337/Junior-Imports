import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const action = readFileSync(resolve(process.cwd(), "src/app/admin/auth-actions.ts"), "utf8");
const form = readFileSync(resolve(process.cwd(), "src/components/admin/admin-login-form.tsx"), "utf8");

describe("CAPTCHA do login administrativo", () => {
  it("envia o token do Turnstile ao Supabase Auth", () => {
    expect(action).toContain('formData.get("captchaToken")');
    expect(action).toContain("options: captchaToken ? { captchaToken } : undefined");
  });

  it("bloqueia o envio quando a proteção está configurada e não foi concluída", () => {
    expect(action).toContain("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
    expect(form).toContain('name="captchaToken"');
    expect(form).toContain("captchaEnabled && !captchaToken");
    expect(form).toContain("TurnstileWidget");
    expect(form).toContain("key={state.captchaVersion}");
    expect(action).toContain("captchaVersion: previous.captchaVersion + 1");
  });
});
