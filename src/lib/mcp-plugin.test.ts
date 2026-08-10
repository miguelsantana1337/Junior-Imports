import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const migration = source("supabase/migrations/202608090003_chatgpt_mcp_plugin.sql").toLowerCase();
const server = source("src/lib/mcp/server.ts");
const authorizePage = source("src/app/admin/mcp/authorize/page.tsx");
const mcpRoute = source("src/app/mcp/route.ts");

describe("plugin privado Junior Imports para ChatGPT", () => {
  it("armazena tokens somente como hash e isola as tabelas do navegador", () => {
    expect(migration).toContain("access_token_hash text not null unique");
    expect(migration).toContain("refresh_token_hash text unique");
    expect(migration).not.toMatch(/\n\s*access_token\s+text/);
    expect(migration).not.toMatch(/\n\s*refresh_token\s+text/);
    expect(migration).toContain("revoke all on table public.mcp_oauth_tokens from public, anon, authenticated");
    expect(migration).toContain("alter table public.mcp_tool_calls enable row level security");
  });

  it("mantém escritas atrás de confirmação curta, única e auditável", () => {
    expect(server).toContain("createMcpConfirmation");
    expect(server).toContain("consumeMcpConfirmation");
    expect(server).toContain("confirmationToken");
    expect(server).toContain("confirmation_required");
    expect(migration).toContain("payload_hash text not null");
    expect(migration).toContain("expires_at timestamptz not null");
    expect(migration).toContain("used_at timestamptz");
  });

  it("exige autenticação forte e reaplica as permissões reais do painel", () => {
    expect(authorizePage).toContain('currentLevel !== "aal2"');
    expect(authorizePage).toContain("requireAdmin()");
    expect(migration).toContain("'aal', 'aal2'");
    expect(migration).toContain("public.has_tenant_permission(p_tenant_id, 'finance')");
    expect(mcpRoute).toContain("authenticateMcpRequest(request)");
  });

  it("prepara o WhatsApp para revisão humana e nunca declara envio automático", () => {
    expect(server).toContain("whatsappUrl(String(view.customer.phone), message)");
    expect(server).toContain("sent: false");
    expect(server.toLowerCase()).toContain("nunca diga que enviou uma mensagem de whatsapp");
  });
});
