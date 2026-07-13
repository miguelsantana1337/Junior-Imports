import { AdminDataProvider } from "@/components/admin/admin-data-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAdmin } from "@/lib/require-admin";
import { getStoreData } from "@/lib/store-data";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const [user, data] = await Promise.all([requireAdmin(), getStoreData({ admin: true })]);
  return <AdminDataProvider initialData={data}><AdminShell email={user.email} demoMode={!isSupabaseConfigured()}>{children}</AdminShell></AdminDataProvider>;
}
