import { isSupabaseConfigured } from "@/lib/supabase/config";

export function shouldAllowDemoAdmin({
  supabaseConfigured,
  nodeEnv,
  vercelEnv,
}: {
  supabaseConfigured: boolean;
  nodeEnv: string | undefined;
  vercelEnv: string | undefined;
}) {
  if (supabaseConfigured) return false;
  if (vercelEnv) return vercelEnv !== "production";
  return nodeEnv !== "production";
}

export function isDemoAdminAllowed() {
  return shouldAllowDemoAdmin({
    supabaseConfigured: isSupabaseConfigured(),
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  });
}
