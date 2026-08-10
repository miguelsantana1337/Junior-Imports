"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export async function disconnectChatGptAction() {
  const actor = await requireAdmin("settings");
  const admin = createAdminClient();
  if (!admin) redirect("/admin/integrations/chatgpt?status=unavailable");

  const revokedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("mcp_oauth_tokens")
    .update({ revoked_at: revokedAt })
    .eq("tenant_id", actor.tenantId)
    .eq("user_id", actor.id)
    .is("revoked_at", null)
    .select("id");

  if (error) redirect("/admin/integrations/chatgpt?status=error");

  await admin.from("audit_logs").insert({
    tenant_id: actor.tenantId,
    actor_id: actor.id,
    actor_email: actor.email,
    action: "update",
    entity_type: "mcp_connections",
    entity_id: actor.id,
    entity_label: "ChatGPT",
    before_data: { active: true },
    after_data: { active: false, revoked_sessions: data?.length ?? 0 },
  });

  redirect("/admin/integrations/chatgpt?status=disconnected");
}
