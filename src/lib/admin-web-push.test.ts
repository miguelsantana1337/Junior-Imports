import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Web Push administrativo", () => {
  const migration = source("supabase/migrations/202608310001_admin_web_push.sql");
  const serviceWorker = source("public/admin-sw.js");
  const pushServer = source("src/lib/admin-push.ts");
  const subscriptionRoute = source("src/app/api/admin/push/subscriptions/route.ts");
  const pushSettings = source("src/components/admin/admin-push-settings.tsx");

  it("persiste inscrições por tenant e usuário com MFA e RLS", () => {
    expect(migration).toContain("create table if not exists public.admin_push_subscriptions");
    expect(migration).toContain("create table if not exists public.admin_push_deliveries");
    expect(migration).toContain("user_id = auth.uid()");
    expect(migration).toContain("public.auth_has_aal2()");
    expect(migration).toContain("revoke all on public.admin_push_subscriptions from anon");
    expect(migration).toContain("unique (subscription_id, notification_key)");
  });

  it("mantém a chave privada somente no servidor", () => {
    expect(pushServer).toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
    expect(pushServer).toContain('import "server-only"');
    expect(pushSettings).not.toContain("WEB_PUSH_VAPID_PRIVATE_KEY");
    expect(pushSettings).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("protege a inscrição por sessão administrativa e origem", () => {
    expect(subscriptionRoute).toContain("requireAdmin()");
    expect(subscriptionRoute).toContain("guardAdminMutation");
    expect(subscriptionRoute).toContain("actor.tenantId");
    expect(subscriptionRoute).toContain("actor.id");
  });

  it("recebe push com o painel fechado e limita o clique ao admin", () => {
    expect(serviceWorker).toContain('addEventListener("push"');
    expect(serviceWorker).toContain("showNotification");
    expect(serviceWorker).toContain('addEventListener("notificationclick"');
    expect(serviceWorker).toContain('url.pathname.startsWith("/admin")');
    expect(serviceWorker).toContain("clients.openWindow");
  });

  it("mantém rotas, cron e interface necessários", () => {
    for (const path of [
      "src/app/api/admin/push/config/route.ts",
      "src/app/api/admin/push/subscriptions/route.ts",
      "src/app/api/admin/push/test/route.ts",
      "src/app/api/cron/admin-push/route.ts",
      "src/components/admin/admin-push-settings.tsx",
    ]) expect(existsSync(resolve(process.cwd(), path))).toBe(true);
    expect(source("vercel.json")).toContain('"/api/cron/admin-push"');
  });
});
