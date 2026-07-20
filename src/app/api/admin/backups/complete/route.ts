import { NextResponse } from "next/server";
import { verifyBackupCompletionToken } from "@/lib/admin-backup";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminBackupCompleteSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const actor = await requireAdmin("data");
  if (actor.role !== "owner" && !actor.isPlatformAdmin) return response({ error: "Acesso negado." }, 403);
  try {
    guardAdminMutation(request, actor.id, 12, 60_000);
  } catch (error) {
    if (error instanceof AdminRequestError) return response({ error: error.message }, error.status);
    return response({ error: "Solicitação inválida." }, 400);
  }

  const parsed = adminBackupCompleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: parsed.error.issues[0]?.message ?? "Resultado inválido." }, 400);
  if (!verifyBackupCompletionToken(parsed.data.completionToken, {
    runId: parsed.data.runId,
    actorId: actor.id,
    tenantId: actor.tenantId,
  })) return response({ error: "A autorização deste backup expirou." }, 403);

  const admin = createAdminClient();
  if (!admin) return response({ error: "Serviço de backup indisponível." }, 503);
  const verified = parsed.data.status === "verified";
  const values = verified ? {
    status: "verified",
    file_sha256: parsed.data.fileSha256,
    size_bytes: parsed.data.sizeBytes,
    verified_at: new Date().toISOString(),
    notes: "Backup criado, criptografado e verificado no navegador após nova confirmação MFA.",
  } : {
    status: "failed",
    notes: parsed.data.errorMessage || "A geração no navegador não foi concluída.",
  };
  const { data: run, error } = await admin.from("backup_runs")
    .update(values)
    .eq("id", parsed.data.runId)
    .eq("tenant_id", actor.tenantId)
    .eq("status", "started")
    .select("id, storage_label")
    .maybeSingle();
  if (error || !run) return response({ error: "Não foi possível concluir o registro do backup." }, 409);

  if (verified) {
    await admin.from("audit_logs").insert({
      tenant_id: actor.tenantId,
      actor_id: actor.id,
      actor_email: actor.email,
      action: "insert",
      entity_type: "backup_runs",
      entity_id: run.id,
      entity_label: run.storage_label,
      after_data: { status: "verified", size_bytes: parsed.data.sizeBytes, file_sha256: parsed.data.fileSha256 },
    });
  }
  return response({ ok: true, status: parsed.data.status });
}
