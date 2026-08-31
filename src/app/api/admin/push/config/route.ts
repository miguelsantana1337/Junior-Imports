import { NextResponse } from "next/server";
import { getAdminPushPublicConfiguration } from "@/lib/admin-push";
import { requireAdmin } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  await requireAdmin();
  return NextResponse.json(getAdminPushPublicConfiguration(), {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}
