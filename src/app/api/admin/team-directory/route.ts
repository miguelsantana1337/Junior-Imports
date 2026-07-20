import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireAdmin("collaboration");
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "Diretório da equipe indisponível." }, { status: 503 });

  const { data: memberships, error: membershipError } = await admin
    .from("tenant_members")
    .select("user_id, role, permissions")
    .eq("tenant_id", actor.tenantId)
    .eq("active", true)
    .limit(250);
  if (membershipError) return NextResponse.json({ error: "Não foi possível carregar a equipe." }, { status: 500 });

  const memberIds = [...new Set((memberships ?? [])
    .filter((item) => item.role === "owner" || (Array.isArray(item.permissions) && item.permissions.includes("collaboration")))
    .map((item) => String(item.user_id))
    .filter(Boolean))];
  if (!memberIds.length) return NextResponse.json({ users: [] }, { headers: { "Cache-Control": "private, no-store" } });

  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email, active")
    .in("id", memberIds)
    .eq("active", true)
    .order("full_name")
    .limit(250);
  if (profileError) return NextResponse.json({ error: "Não foi possível carregar a equipe." }, { status: 500 });

  return NextResponse.json({
    users: (profiles ?? []).map((profile) => ({
      id: String(profile.id),
      email: String(profile.email ?? ""),
      fullName: String(profile.full_name ?? profile.email ?? "Usuário"),
    })),
  }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}
