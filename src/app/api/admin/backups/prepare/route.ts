import { NextResponse } from "next/server";
import {
  buildTenantBackupManifest,
  createWrappedBackupKey,
  issueBackupCompletionToken,
} from "@/lib/admin-backup";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { adminBackupPrepareSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function POST(request: Request) {
  const actor = await requireAdmin("data");
  if (actor.role !== "owner" && !actor.isPlatformAdmin) {
    return errorResponse("Somente o proprietário pode gerar um backup completo.", 403);
  }
  try {
    guardAdminMutation(request, actor.id, 4, 60_000);
  } catch (error) {
    if (error instanceof AdminRequestError) return errorResponse(error.message, error.status);
    return errorResponse("Solicitação inválida.", 400);
  }

  const parsed = adminBackupPrepareSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Código inválido.", 400);

  const sessionClient = await createClient();
  if (!sessionClient) return errorResponse("Autenticação indisponível.", 503);
  const factors = await sessionClient.auth.mfa.listFactors();
  const verifiedFactors = ((factors.data as { all?: Array<{ id: string; status: string; factor_type: string }> } | null)?.all ?? [])
    .filter((factor) => factor.status === "verified" && factor.factor_type === "totp");
  if (factors.error || !verifiedFactors.some((factor) => factor.id === parsed.data.factorId)) {
    return errorResponse("O autenticador selecionado não está disponível para esta conta.", 400);
  }
  const proof = await sessionClient.auth.mfa.challengeAndVerify({
    factorId: parsed.data.factorId,
    code: parsed.data.code,
  });
  if (proof.error) return errorResponse("Código inválido ou expirado. Aguarde o próximo código e tente novamente.", 401);

  const admin = createAdminClient();
  if (!admin) return errorResponse("Serviço de backup indisponível.", 503);
  const { data: run, error: runError } = await admin.from("backup_runs").insert({
    tenant_id: actor.tenantId,
    status: "started",
    backup_type: "logical_encrypted",
    actor_email: actor.email,
    notes: "Backup iniciado no painel após nova confirmação MFA.",
  }).select("id").single();
  if (runError || !run) return errorResponse("Não foi possível iniciar o registro do backup.", 500);

  try {
    const manifest = await buildTenantBackupManifest(admin, actor);
    const { dataKey, keyWrap } = createWrappedBackupKey();
    const filename = `junior-imports-${manifest.createdAt.replace(/[:.]/g, "-")}.jibackup`;
    const completionToken = issueBackupCompletionToken({ runId: run.id, actorId: actor.id, tenantId: actor.tenantId });
    const responseBody = {
      runId: run.id,
      completionToken,
      filename,
      dataKey,
      keyWrap,
      payload: {
        format: "junior-imports-logical-payload" as const,
        version: 2 as const,
        createdAt: manifest.createdAt,
        tenant: manifest.tenant,
        tables: manifest.tables,
        limitations: [
          "Auth passwords, MFA secrets and sessions are managed by Supabase Auth and are not included.",
          "Transient presence and edit-lock leases are intentionally excluded.",
        ],
      },
      mediaSources: manifest.mediaSources,
      summary: manifest.summary,
    };
    if (Buffer.byteLength(JSON.stringify(responseBody)) > 4_000_000) {
      throw new Error("Os registros excederam o limite seguro do painel. Use a rotina pelo terminal.");
    }
    await admin.from("backup_runs").update({
      storage_label: filename,
      key_fingerprint: keyWrap.keyFingerprint,
      table_count: manifest.summary.tableCount,
      row_count: manifest.summary.rowCount,
      media_count: manifest.summary.mediaCount,
      notes: "Manifesto liberado após MFA; aguardando criptografia e verificação no navegador.",
    }).eq("id", run.id).eq("tenant_id", actor.tenantId);

    return NextResponse.json(responseBody, {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 300) : "Falha ao preparar o backup.";
    await admin.from("backup_runs").update({ status: "failed", notes: message }).eq("id", run.id).eq("tenant_id", actor.tenantId);
    return errorResponse(message, 500);
  }
}
