import "server-only";

import { requireAdmin } from "@/lib/require-admin";

export async function requirePlatformAdmin() {
  const actor = await requireAdmin();
  if (!actor.isPlatformAdmin) throw new Error("PLATFORM_ACCESS_DENIED");
  return actor;
}
