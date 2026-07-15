import { redirect } from "next/navigation";
import { SaasConsole } from "@/components/saas/saas-console";
import { requireAdmin } from "@/lib/require-admin";

export default async function SaasPage() {
  const actor = await requireAdmin();
  if (!actor.isPlatformAdmin) redirect("/admin");
  return <SaasConsole actorName={actor.fullName.split(/\s+/)[0] || "Administrador"} />;
}
