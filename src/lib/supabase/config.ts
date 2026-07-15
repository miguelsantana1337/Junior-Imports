import { platformConfig } from "@/config/platform";

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export const demoAdminCredentials = {
  email: platformConfig.demoAdmin.email,
  password: platformConfig.demoAdmin.password,
};
