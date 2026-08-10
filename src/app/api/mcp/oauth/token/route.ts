import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mcpUrls, normalizeScopes } from "@/lib/mcp/config";
import { hashSecret, pkceChallenge, randomOpaqueToken } from "@/lib/mcp/crypto";

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json({ error, error_description: description }, { status, headers: { "Cache-Control": "no-store" } });
}

async function issueTokens(input: { clientId: string; userId: string; tenantId: string; scopes: string[]; resource: string }) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível");
  const accessToken = randomOpaqueToken("ji_mcp_access");
  const refreshToken = randomOpaqueToken("ji_mcp_refresh");
  const expiresIn = 30 * 60;
  const { error } = await admin.from("mcp_oauth_tokens").insert({
    access_token_hash: hashSecret(accessToken),
    refresh_token_hash: hashSecret(refreshToken),
    client_id: input.clientId,
    user_id: input.userId,
    tenant_id: input.tenantId,
    scopes: input.scopes,
    resource: input.resource,
    expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  if (error) throw new Error(error.message);
  return { access_token: accessToken, refresh_token: refreshToken, token_type: "Bearer", expires_in: expiresIn, scope: input.scopes.join(" ") };
}

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const grantType = form.get("grant_type") ?? "";
  const clientId = form.get("client_id")?.trim() ?? "";
  const resource = form.get("resource")?.trim() ?? "";
  if (!clientId || resource !== mcpUrls().resource) return tokenError("invalid_request", "Cliente ou recurso inválido.");
  const admin = createAdminClient();
  if (!admin) return tokenError("temporarily_unavailable", "Serviço indisponível.", 503);

  const { data: client } = await admin.from("mcp_oauth_clients").select("active").eq("client_id", clientId).maybeSingle();
  if (!client?.active) return tokenError("invalid_client", "Cliente não registrado.", 401);

  if (grantType === "authorization_code") {
    const code = form.get("code") ?? "";
    const redirectUri = form.get("redirect_uri") ?? "";
    const verifier = form.get("code_verifier") ?? "";
    const { data: stored } = await admin
      .from("mcp_oauth_codes")
      .select("code_hash, client_id, user_id, tenant_id, redirect_uri, scopes, code_challenge, resource, expires_at, used_at")
      .eq("code_hash", hashSecret(code))
      .maybeSingle();
    if (!stored || stored.used_at || new Date(stored.expires_at).getTime() <= Date.now()
      || stored.client_id !== clientId || stored.redirect_uri !== redirectUri || stored.resource !== resource
      || !verifier || pkceChallenge(verifier) !== stored.code_challenge) {
      return tokenError("invalid_grant", "Código inválido, expirado ou PKCE incorreto.");
    }
    const now = new Date().toISOString();
    const { data: consumed } = await admin.from("mcp_oauth_codes").update({ used_at: now }).eq("code_hash", stored.code_hash).is("used_at", null).select("code_hash").maybeSingle();
    if (!consumed) return tokenError("invalid_grant", "Este código já foi utilizado.");
    try {
      const tokens = await issueTokens({ clientId, userId: stored.user_id, tenantId: stored.tenant_id, scopes: stored.scopes, resource });
      await admin.from("mcp_oauth_clients").update({ last_used_at: now }).eq("client_id", clientId);
      await admin.rpc("cleanup_expired_mcp_records");
      return NextResponse.json(tokens, { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
    } catch {
      return tokenError("server_error", "Não foi possível emitir o token.", 500);
    }
  }

  if (grantType === "refresh_token") {
    const refreshToken = form.get("refresh_token") ?? "";
    const { data: stored } = await admin
      .from("mcp_oauth_tokens")
      .select("id, client_id, user_id, tenant_id, scopes, resource, refresh_expires_at, revoked_at")
      .eq("refresh_token_hash", hashSecret(refreshToken))
      .maybeSingle();
    if (!stored || stored.revoked_at || stored.client_id !== clientId || stored.resource !== resource
      || !stored.refresh_expires_at || new Date(stored.refresh_expires_at).getTime() <= Date.now()) {
      return tokenError("invalid_grant", "A conexão expirou. Vincule a conta novamente.");
    }
    const storedScopes = Array.isArray(stored.scopes) ? stored.scopes as string[] : [];
    const requested: string[] = form.has("scope") ? normalizeScopes(form.get("scope")) : storedScopes;
    if (requested.some((scope) => !storedScopes.includes(scope))) return tokenError("invalid_scope", "Escopo não autorizado.");
    const revokedAt = new Date().toISOString();
    const { data: revoked } = await admin.from("mcp_oauth_tokens").update({ revoked_at: revokedAt }).eq("id", stored.id).is("revoked_at", null).select("id").maybeSingle();
    if (!revoked) return tokenError("invalid_grant", "Este token de renovação já foi utilizado.");
    try {
      return NextResponse.json(await issueTokens({ clientId, userId: stored.user_id, tenantId: stored.tenant_id, scopes: requested, resource }), { headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
    } catch {
      return tokenError("server_error", "Não foi possível renovar o token.", 500);
    }
  }

  return tokenError("unsupported_grant_type", "Fluxo OAuth não suportado.");
}
