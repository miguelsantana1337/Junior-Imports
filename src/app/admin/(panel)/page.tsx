import { DashboardAdmin } from "@/components/admin/dashboard-admin";
import { requireAdmin } from "@/lib/require-admin";

export default async function AdminDashboardPage() {
  await requireAdmin("dashboard");
  return <DashboardAdmin />;
}
