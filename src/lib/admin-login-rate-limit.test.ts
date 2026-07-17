import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607170001_admin_login_rate_limit.sql"),
  "utf8",
).toLowerCase();

describe("rate limit do login administrativo", () => {
  it("adiciona login à lista restrita de ações", () => {
    expect(migration).toContain("'login'");
    expect(migration).toContain("storefront_rate_limits_action_check");
  });

  it("permite limpar o contador depois de um login válido", () => {
    expect(migration).toContain("create or replace function public.clear_storefront_rate_limit");
    expect(migration).toContain("delete from public.storefront_rate_limits");
  });

  it("mantém as duas RPCs disponíveis somente para service role", () => {
    expect(migration).toContain(
      "revoke all on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer)",
    );
    expect(migration).toContain(
      "revoke all on function public.clear_storefront_rate_limit(uuid, text, text)",
    );
    expect(migration.match(/to service_role/g)).toHaveLength(2);
  });
});
