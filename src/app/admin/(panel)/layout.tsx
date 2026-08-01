import type { Metadata, Viewport } from "next";
import { AdminDataProvider } from "@/components/admin/admin-data-provider";
import { AdminShell } from "@/components/admin/admin-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { requireAdmin } from "@/lib/require-admin";
import { getStoreData } from "@/lib/store-data";
import { hasAdminPermission } from "@/lib/admin-permissions";

export const metadata: Metadata = {
  applicationName: "Junior Imports — Painel de Controle",
  manifest: "/admin-manifest.webmanifest",
  icons: {
    icon: "/pwa/admin-icon-192.png",
    apple: "/pwa/admin-apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Junior Admin",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#1677ff",
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  // A single request-scoped value is serialized so time-sensitive client views hydrate deterministically.
  // eslint-disable-next-line react-hooks/purity
  const referenceNow = Date.now();
  const data = await getStoreData({
    admin: true,
    tenantSlug: user.tenantSlug,
    role: user.role,
    permissions: user.permissions,
    includeAudit: hasAdminPermission(user.role, user.permissions, "audit"),
  });
  return <AdminDataProvider initialData={data} currentUser={user} referenceNow={referenceNow}><AdminShell user={user} demoMode={!isSupabaseConfigured()}>{children}</AdminShell></AdminDataProvider>;
}
