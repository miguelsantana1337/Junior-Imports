import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

function deploymentEnvironment() {
  if (process.env.VERCEL_ENV === "preview") return "preview";
  if (process.env.NODE_ENV === "development") return "development";
  return "production";
}

export async function featureEnabled(
  client: AdminClient,
  input: { tenantId: string; key: string; subject?: string; role?: string; fallback?: boolean },
) {
  const { data, error } = await client.rpc("evaluate_feature_flag", {
    p_tenant_id: input.tenantId,
    p_key: input.key,
    p_environment: deploymentEnvironment(),
    p_subject: input.subject ?? "",
    p_role: input.role ?? "",
  });
  if (error) return input.fallback ?? false;
  return data === true;
}
