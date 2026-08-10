import { NextResponse } from "next/server";
import { mcpScopes, mcpUrls } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const urls = mcpUrls();
  return NextResponse.json({
    issuer: urls.origin,
    authorization_endpoint: urls.authorizationEndpoint,
    token_endpoint: urls.tokenEndpoint,
    registration_endpoint: urls.registrationEndpoint,
    revocation_endpoint: `${urls.origin}/api/mcp/oauth/revoke`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: mcpScopes,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
