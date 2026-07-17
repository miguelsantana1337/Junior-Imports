import { NextResponse } from "next/server";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminMfaAuditSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const actor = await requireAdmin();
  try {
    guardAdminMutation(request, actor.id, 12);
  } catch (error) {
    if (error instanceof AdminRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  const parsed = adminMfaAuditSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Dados de auditoria inválidos." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Auditoria indisponível." }, { status: 503 });
  }

  const factorSnapshot = {
    factor_type: "totp",
    friendly_name: parsed.data.friendlyName,
  };
  const { error } = await supabase.from("audit_logs").insert({
    tenant_id: actor.tenantId,
    actor_id: actor.id,
    actor_email: actor.email,
    action: parsed.data.action === "enroll" ? "insert" : "delete",
    entity_type: "auth_mfa_factors",
    entity_id: parsed.data.factorId,
    entity_label: parsed.data.friendlyName,
    before_data: parsed.data.action === "remove" ? factorSnapshot : null,
    after_data: parsed.data.action === "enroll" ? factorSnapshot : null,
  });

  if (error) {
    return NextResponse.json({ error: "Não foi possível registrar a auditoria." }, { status: 500 });
  }
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
