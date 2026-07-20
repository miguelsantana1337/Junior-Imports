import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/202607180008_admin_notifications.sql"),
  "utf8",
);

describe("persistência das notificações administrativas", () => {
  it("isola leitura e adiamento por tenant e usuário", () => {
    expect(migration).toContain("create table if not exists public.admin_notification_states");
    expect(migration).toContain("primary key (tenant_id, user_id, notification_key)");
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("public.auth_has_aal2()");
  });

  it("sincroniza alterações por realtime", () => {
    expect(migration).toContain("alter publication supabase_realtime add table public.admin_notification_states");
  });
});
