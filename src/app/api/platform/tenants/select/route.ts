import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function POST(request: Request) {
  const actor = await requireAdmin();
  const payload = await request.json().catch(() => null) as { slug?: string } | null;
  const slug = String(payload?.slug ?? "");
  const supabase = createAdminClient();
  if (!supabase || !slug) return NextResponse.json({ error: "Cliente inválido." }, { status: 400 });
  const { data: tenant } = await supabase.from("tenants").select("id, slug").eq("slug", slug).maybeSingle();
  if (!tenant) return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  if (!actor.isPlatformAdmin) {
    const { data: membership } = await supabase.from("tenant_members").select("active").eq("tenant_id", tenant.id).eq("user_id", actor.id).maybeSingle();
    if (!membership?.active) return NextResponse.json({ error: "Você não possui acesso a esta loja." }, { status: 403 });
  }
  const cookieStore = await cookies();
  cookieStore.set("saas-tenant", tenant.slug, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return NextResponse.json({ ok: true });
}
