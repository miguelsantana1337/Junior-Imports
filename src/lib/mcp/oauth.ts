import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedMcpRedirectUri, mcpScopes, mcpUrls, normalizeScopes, type McpScope } from "@/lib/mcp/config";

export interface OAuthAuthorizeRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  state: string;
  scopes: McpScope[];
  codeChallenge: string;
  resource: string;
}

export class OAuthRequestError extends Error {
  constructor(message: string, readonly code = "invalid_request") {
    super(message);
  }
}

export async function validateOAuthAuthorizeRequest(params: URLSearchParams): Promise<OAuthAuthorizeRequest> {
  const clientId = params.get("client_id")?.trim() ?? "";
  const redirectUri = params.get("redirect_uri")?.trim() ?? "";
  const state = params.get("state")?.trim() ?? "";
  const codeChallenge = params.get("code_challenge")?.trim() ?? "";
  const resource = params.get("resource")?.trim() ?? "";
  const responseType = params.get("response_type")?.trim() ?? "";
  const challengeMethod = params.get("code_challenge_method")?.trim() ?? "";
  if (!clientId || !redirectUri || !state || !codeChallenge) throw new OAuthRequestError("Parâmetros OAuth incompletos.");
  if (responseType !== "code") throw new OAuthRequestError("Somente response_type=code é aceito.", "unsupported_response_type");
  if (challengeMethod !== "S256") throw new OAuthRequestError("PKCE S256 é obrigatório.", "invalid_request");
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(codeChallenge)) throw new OAuthRequestError("Desafio PKCE inválido.");
  if (resource !== mcpUrls().resource) throw new OAuthRequestError("Recurso MCP inválido.", "invalid_target");
  if (!isAllowedMcpRedirectUri(redirectUri)) throw new OAuthRequestError("URL de retorno não autorizada.");

  const admin = createAdminClient();
  if (!admin) throw new OAuthRequestError("Serviço de autenticação indisponível.", "temporarily_unavailable");
  const { data: client } = await admin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, active")
    .eq("client_id", clientId)
    .maybeSingle();
  if (!client?.active || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(redirectUri)) {
    throw new OAuthRequestError("Cliente OAuth não registrado.", "unauthorized_client");
  }

  const requestedScopes = normalizeScopes(params.get("scope"));
  const rawScopes = (params.get("scope") ?? "junior.read")
    .split(/\s+/)
    .filter(Boolean);
  if (rawScopes.some((scope) => !mcpScopes.includes(scope as McpScope))) {
    throw new OAuthRequestError("Escopo não reconhecido.", "invalid_scope");
  }
  return {
    clientId,
    clientName: client.client_name,
    redirectUri,
    state,
    scopes: requestedScopes,
    codeChallenge,
    resource,
  };
}

export function oauthRedirect(request: OAuthAuthorizeRequest, values: Record<string, string>) {
  const destination = new URL(request.redirectUri);
  Object.entries({ ...values, state: request.state }).forEach(([key, value]) => destination.searchParams.set(key, value));
  return destination;
}
