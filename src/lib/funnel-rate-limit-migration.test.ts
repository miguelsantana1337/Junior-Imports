import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202608100011_fix_funnel_event_rate_limit.sql"),
  "utf8",
);

describe("funnel event rate limiting migration", () => {
  it("permite a ação de telemetria no constraint e nas funções", () => {
    expect(migration).toContain("'funnel_event'");
    expect(migration).toContain("storefront_rate_limits_action_check");
    expect(migration).toContain("p_limit > 300");
  });

  it("mantém as funções restritas ao service role", () => {
    expect(migration).toContain(
      "grant execute on function public.consume_storefront_rate_limit(uuid, text, text, integer, integer) to service_role",
    );
    expect(migration).toContain(
      "grant execute on function public.clear_storefront_rate_limit(uuid, text, text) to service_role",
    );
  });
});
