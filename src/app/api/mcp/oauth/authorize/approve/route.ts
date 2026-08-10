import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret, randomOpaqueToken } from "@/lib/mcp/crypto";
import { oauthRedirect, OAuthRequestError, validateOAuthAuthorizeRequest } from "@/lib/mcp/oauth";

export async function POST(request: Request) {
  const actor = await requireAdmin();
  try {
    guardAdminMutation(request, actor.id, 10);
  } catch (error) {
    const status = error instanceof AdminRequestError ? error.status : 400;
    return NextResponse.json({ error: "invalid_request" }, { status });
  }
  const form = await request.formData();
  const params = new URLSearchParams();
  ["client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method", "response_type", "resource"]
    .forEach((key) => params.set(key, String(form.get(key) ?? "")));

  let oauthRequest;
  try {
    oauthRequest = await validateOAuthAuthorizeRequest(params);
  } catch (error) {
    const known = error instanceof OAuthRequestError ? error : new OAuthRequestError("Solicitação OAuth inválida.");
    return NextResponse.json({ error: known.code, error_description: known.message }, { status: 400 });
  }

  if (form.get("decision") !== "approve") {
    return NextResponse.redirect(oauthRedirect(oauthRequest, { error: "access_denied", error_description: "Conexão recusada pelo usuário." }), 303);
  }

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  const code = randomOpaqueToken("ji_mcp_code");
  const { error } = await admin.from("mcp_oauth_codes").insert({
    code_hash: hashSecret(code),
    client_id: oauthRequest.clientId,
    user_id: actor.id,
    tenant_id: actor.tenantId,
    redirect_uri: oauthRequest.redirectUri,
    scopes: oauthRequest.scopes,
    code_challenge: oauthRequest.codeChallenge,
    resource: oauthRequest.resource,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });

  await admin.from("audit_logs").insert({
    tenant_id: actor.tenantId,
    actor_id: actor.id,
    actor_email: actor.email,
    action: "insert",
    entity_type: "mcp_connections",
    entity_id: oauthRequest.clientId,
    entity_label: "ChatGPT",
    before_data: null,
    after_data: { scopes: oauthRequest.scopes, mfa_required: true },
  });
  return NextResponse.redirect(oauthRedirect(oauthRequest, { code }), 303);
}
