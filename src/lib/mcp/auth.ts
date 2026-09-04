import "server-only";

import type { AdminPermission, AdminRole } from "@/types/store";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/mcp/crypto";
import { mcpScopes, mcpUrls, type McpScope } from "@/lib/mcp/config";

export interface McpActor {
  id: string;
  email: string;
  fullName: string;
  tenantId: string;
  tenantSlug: string;
  role: AdminRole;
  permissions: AdminPermission[];
  scopes: McpScope[];
  tokenId: string;
  isPlatformAdmin: boolean;
}

export class McpAuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
    readonly code = "invalid_token",
    readonly scope = "junior.read",
  ) {
    super(message);
  }
}

export function mcpAuthorizationChallenge(error = "invalid_token", description = "Conecte sua conta administrativa para continuar.", scope = "junior.read") {
  const { protectedResourceMetadata } = mcpUrls();
  const safeDescription = description.replaceAll('"', "'");
  return `Bearer resource_metadata="${protectedResourceMetadata}", error="${error}", error_description="${safeDescription}", scope="${scope}"`;
}

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() ?? "";
}

export async function authenticateMcpRequest(request: Request): Promise<McpActor> {
  const token = bearerToken(request);
  if (!token) throw new McpAuthError("Autenticação necessária.");

  const admin = createAdminClient();
  if (!admin) throw new McpAuthError("Integração temporariamente indisponível.", 503, "server_error");
  const now = new Date().toISOString();
  const { data: stored, error } = await admin
    .from("mcp_oauth_tokens")
    .select("id, user_id, tenant_id, scopes, resource, expires_at, revoked_at")
    .eq("access_token_hash", hashSecret(token))
    .maybeSingle();

  if (error || !stored || stored.revoked_at) throw new McpAuthError("A conexão não é mais válida.");
  if (stored.resource !== mcpUrls().resource) throw new McpAuthError("Token emitido para outro recurso.");
  if (new Date(stored.expires_at).getTime() <= Date.now()) throw new McpAuthError("A sessão da integração expirou.");

  const [{ data: profile }, { data: membership }, { data: tenant }] = await Promise.all([
    admin.from("profiles").select("email, full_name, active, is_platform_admin, must_change_password").eq("id", stored.user_id).maybeSingle(),
    admin.from("tenant_members").select("role, permissions, active").eq("tenant_id", stored.tenant_id).eq("user_id", stored.user_id).maybeSingle(),
    admin.from("tenants").select("slug, status").eq("id", stored.tenant_id).maybeSingle(),
  ]);

  const isPlatformAdmin = Boolean(profile?.is_platform_admin);
  if (!profile?.active || profile.must_change_password || !tenant || !["active", "trial"].includes(tenant.status)) {
    throw new McpAuthError("O usuário ou a loja está inativo.", 403, "access_denied");
  }
  if (!isPlatformAdmin && !membership?.active) {
    throw new McpAuthError("Seu acesso a esta loja foi removido.", 403, "access_denied");
  }

  const scopes = (Array.isArray(stored.scopes) ? stored.scopes : [])
    .filter((scope): scope is McpScope => mcpScopes.includes(scope as McpScope));
  await admin.from("mcp_oauth_tokens").update({ last_used_at: now }).eq("id", stored.id);

  return {
    id: stored.user_id,
    email: profile.email ?? "",
    fullName: profile.full_name || profile.email?.split("@")[0] || "Administrador",
    tenantId: stored.tenant_id,
    tenantSlug: tenant.slug,
    role: (membership?.role ?? "owner") as AdminRole,
    permissions: Array.isArray(membership?.permissions) ? membership.permissions as AdminPermission[] : [],
    scopes,
    tokenId: stored.id,
    isPlatformAdmin,
  };
}

export function requireMcpScope(actor: McpActor, scope: McpScope) {
  if (!actor.scopes.includes(scope)) {
    throw new McpAuthError(`A integração não possui o escopo ${scope}.`, 403, "insufficient_scope", scope);
  }
}

export function requireMcpPermission(actor: McpActor, permission: AdminPermission) {
  if (!actor.isPlatformAdmin && actor.role !== "owner" && !actor.permissions.includes(permission)) {
    throw new McpAuthError(`Seu usuário não possui a permissão ${permission}.`, 403, "insufficient_scope");
  }
}
