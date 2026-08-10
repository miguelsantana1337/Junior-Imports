import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { hashPayload, hashSecret, randomOpaqueToken } from "@/lib/mcp/crypto";
import type { McpActor } from "@/lib/mcp/auth";

type ConfirmationResult = {
  id: string;
  token: string;
  expiresAt: string;
};

export async function createMcpConfirmation(
  actor: McpActor,
  toolName: string,
  payload: unknown,
  summary: string,
): Promise<ConfirmationResult> {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const token = randomOpaqueToken("mcp_confirm");
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  const { data, error } = await admin.from("mcp_action_confirmations").insert({
    token_hash: hashSecret(token),
    tenant_id: actor.tenantId,
    actor_id: actor.id,
    tool_name: toolName,
    payload_hash: hashPayload(payload),
    summary: summary.slice(0, 1000),
    expires_at: expiresAt,
  }).select("id").single();
  if (error || !data) throw new Error("Não foi possível preparar a confirmação.");
  return { id: data.id, token, expiresAt };
}
export async function consumeMcpConfirmation(
  actor: McpActor,
  toolName: string,
  payload: unknown,
  token: string,
) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const now = new Date().toISOString();
  const { data: confirmation } = await admin
    .from("mcp_action_confirmations")
    .select("id, tenant_id, actor_id, tool_name, payload_hash, expires_at, used_at")
    .eq("token_hash", hashSecret(token))
    .maybeSingle();

  if (!confirmation
    || confirmation.tenant_id !== actor.tenantId
    || confirmation.actor_id !== actor.id
    || confirmation.tool_name !== toolName
    || confirmation.payload_hash !== hashPayload(payload)
    || confirmation.used_at
    || new Date(confirmation.expires_at).getTime() <= Date.now()) {
    throw new Error("A confirmação é inválida ou expirou. Prepare a ação novamente.");
  }

  const { data: consumed, error } = await admin
    .from("mcp_action_confirmations")
    .update({ used_at: now })
    .eq("id", confirmation.id)
    .is("used_at", null)
    .gt("expires_at", now)
    .select("id")
    .maybeSingle();
  if (error || !consumed) throw new Error("Esta confirmação já foi utilizada.");
  return confirmation.id as string;
}

export async function logMcpToolCall(input: {
  actor: McpActor;
  toolName: string;
  operation: "read" | "write";
  status: "completed" | "confirmation_required" | "blocked" | "failed";
  request: unknown;
  confirmationId?: string;
  startedAt: number;
  errorCode?: string;
}) {
  const admin = createAdminClient();
  if (!admin) return;
  await admin.from("mcp_tool_calls").insert({
    tenant_id: input.actor.tenantId,
    actor_id: input.actor.id,
    tool_name: input.toolName,
    operation: input.operation,
    status: input.status,
    request_hash: hashPayload(input.request),
    confirmation_id: input.confirmationId ?? null,
    duration_ms: Math.max(0, Date.now() - input.startedAt),
    error_code: (input.errorCode ?? "").slice(0, 120),
  });
}

export async function enforceMcpRateLimit(actor: McpActor, operation: "read" | "write") {
  const admin = createAdminClient();
  if (!admin) throw new Error("Supabase indisponível.");
  const since = new Date(Date.now() - 60_000).toISOString();
  const limit = operation === "write" ? 20 : 60;
  const { count } = await admin
    .from("mcp_tool_calls")
    .select("id", { head: true, count: "exact" })
    .eq("tenant_id", actor.tenantId)
    .eq("actor_id", actor.id)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) throw new Error("Muitas solicitações em pouco tempo. Aguarde um minuto.");
}
