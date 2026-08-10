import "server-only";

import { platformConfig } from "@/config/platform";

export const mcpScopes = ["junior.read", "junior.write"] as const;
export type McpScope = (typeof mcpScopes)[number];

function siteOrigin() {
  const configured = new URL(platformConfig.siteUrl);
  return configured.origin;
}
export function mcpUrls() {
  const origin = siteOrigin();
  return {
    origin,
    resource: `${origin}/mcp`,
    protectedResourceMetadata: `${origin}/.well-known/oauth-protected-resource`,
    authorizationServerMetadata: `${origin}/.well-known/oauth-authorization-server`,
    authorizationEndpoint: `${origin}/api/mcp/oauth/authorize`,
    tokenEndpoint: `${origin}/api/mcp/oauth/token`,
    registrationEndpoint: `${origin}/api/mcp/oauth/register`,
    documentation: `${origin}/admin/integrations/chatgpt`,
  };
}

export function normalizeScopes(value: string | null | undefined) {
  const requested = (value ?? "junior.read junior.write")
    .split(/\s+/)
    .filter((scope): scope is McpScope => mcpScopes.includes(scope as McpScope));
  return [...new Set(requested.length ? requested : ["junior.read"])] as McpScope[];
}

export function isAllowedMcpRedirectUri(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  if (url.protocol === "https:" && url.hostname === "chatgpt.com") {
    return url.pathname.startsWith("/connector/oauth/")
      || url.pathname === "/connector_platform_oauth_redirect";
  }

  if (process.env.NODE_ENV !== "production" && url.protocol === "http:") {
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  }

  return false;
}
