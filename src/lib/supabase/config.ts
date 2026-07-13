export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

export const demoAdminCredentials = {
  email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? "admin@juniorimports.demo",
  password: process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? "junior123",
};
