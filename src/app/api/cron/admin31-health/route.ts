import { NextResponse } from "next/server";
import { runContinuityScan } from "@/lib/admin31-continuity";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });
  const { data: tenants, error } = await client.from("tenants").select("id").eq("active", true);
  if (error) return NextResponse.json({ error: "Não foi possível listar os ambientes." }, { status: 500 });
  const results = [];
  for (const tenant of tenants ?? []) {
    try {
      results.push({ tenantId: tenant.id, ok: true, ...(await runContinuityScan(client, tenant.id)) });
    } catch (caught) {
      results.push({ tenantId: tenant.id, ok: false, error: caught instanceof Error ? caught.message : "Falha na verificação" });
    }
  }
  return NextResponse.json({ ok: results.every((item) => item.ok), results }, { headers: { "Cache-Control": "no-store" } });
}
