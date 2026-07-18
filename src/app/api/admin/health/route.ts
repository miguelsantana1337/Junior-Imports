import { NextResponse } from "next/server";
import { backupFreshness, deriveHealthStatus, healthEnvironment, type AdminHealthCheck, type AdminHealthReport } from "@/lib/admin-health";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function response(report: AdminHealthReport) {
  return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function GET() {
  const user = await requireAdmin("data");
  const checkedAt = new Date().toISOString();
  const environment = healthEnvironment(process.env.VERCEL_ENV);
  const deploymentId = process.env.VERCEL_DEPLOYMENT_ID?.slice(0, 80) || "local";
  const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || "local";

  if (!isSupabaseConfigured()) {
    const checks: AdminHealthCheck[] = [
      { id: "database", title: "Banco de dados", status: "warning", summary: "Modo local ativo", detail: "Os dados desta sessão não estão conectados ao Supabase." },
      { id: "authentication", title: "Autenticação", status: "warning", summary: "Acesso demonstrativo", detail: "MFA e sessões reais ficam disponíveis com o Supabase conectado." },
      { id: "audit", title: "Auditoria", status: "unknown", summary: "Sem fonte remota", detail: "Não é possível confirmar a persistência da trilha de auditoria no modo local." },
      { id: "backup", title: "Backup", status: "warning", summary: "Backup remoto indisponível", detail: "Execute a rotina criptografada em um ambiente conectado ao projeto." },
      { id: "deployment", title: "Deploy", status: "healthy", summary: "Ambiente de desenvolvimento", detail: "O modo demonstrativo é bloqueado automaticamente em produção." },
    ];
    return response({ status: deriveHealthStatus(checks), checkedAt, environment, deploymentId, commitSha, checks });
  }

  const supabase = await createClient();
  const admin = createAdminClient();
  const databaseStartedAt = Date.now();
  const tenantResult = supabase
    ? await supabase.from("tenants").select("id, name, status").eq("id", user.tenantId).maybeSingle()
    : { data: null, error: new Error("client unavailable") };
  const databaseLatency = Date.now() - databaseStartedAt;
  const databaseHealthy = !tenantResult.error && Boolean(tenantResult.data);

  const [authResult, auditResult, backupResult] = admin ? await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    admin.from("audit_logs").select("created_at").eq("tenant_id", user.tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("backup_runs").select("status, created_at, verified_at, storage_label, size_bytes, row_count, media_count").eq("tenant_id", user.tenantId).in("status", ["completed", "verified"]).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]) : [
    { data: { users: [] }, error: new Error("admin unavailable") },
    { data: null, error: new Error("admin unavailable") },
    { data: null, error: new Error("admin unavailable") },
  ];

  const latestBackupAt = backupResult.data?.verified_at || backupResult.data?.created_at || null;
  const backupStatus = backupResult.error ? "critical" : backupFreshness(latestBackupAt);
  const checks: AdminHealthCheck[] = [
    {
      id: "database",
      title: "Banco de dados",
      status: databaseHealthy ? "healthy" : "critical",
      summary: databaseHealthy ? "Supabase respondendo" : "Falha na conexão",
      detail: databaseHealthy ? `Tenant ${tenantResult.data?.name ?? user.tenantSlug} acessível e isolado.` : "A consulta autenticada do tenant não foi concluída.",
      latencyMs: databaseLatency,
    },
    {
      id: "authentication",
      title: "Autenticação",
      status: !authResult.error ? "healthy" : "critical",
      summary: !authResult.error ? "Serviço de autenticação ativo" : "Autenticação administrativa indisponível",
      detail: !authResult.error ? "A API de usuários respondeu e a sessão atual passou pela exigência de MFA." : "A central não conseguiu validar a API administrativa de autenticação.",
    },
    {
      id: "audit",
      title: "Auditoria",
      status: auditResult.error ? "critical" : "healthy",
      summary: auditResult.error ? "Trilha indisponível" : auditResult.data ? "Persistência confirmada" : "Pronta, sem eventos",
      detail: auditResult.error ? "A tabela de auditoria não respondeu à verificação." : auditResult.data ? "Última alteração administrativa registrada com sucesso." : "A estrutura está acessível e aguardando a primeira alteração.",
      observedAt: auditResult.data?.created_at,
    },
    {
      id: "backup",
      title: "Backup criptografado",
      status: backupStatus,
      summary: backupResult.error ? "Registro indisponível" : latestBackupAt ? backupStatus === "healthy" ? "Backup recente" : "Backup precisa ser renovado" : "Nenhum backup confirmado",
      detail: backupResult.error ? "A central não conseguiu consultar o histórico de backups." : latestBackupAt ? `${backupResult.data?.row_count ?? 0} registros e ${backupResult.data?.media_count ?? 0} arquivos no último pacote.` : "Execute pnpm backup:database em um ambiente seguro.",
      observedAt: latestBackupAt ?? undefined,
    },
    {
      id: "deployment",
      title: "Deploy",
      status: environment === "production" ? "healthy" : "warning",
      summary: environment === "production" ? "Produção ativa" : environment === "preview" ? "Ambiente de preview" : "Ambiente local",
      detail: commitSha === "local" ? "Build local sem identificador de commit." : `Commit ${commitSha} em execução na Vercel.`,
    },
  ];

  return response({ status: deriveHealthStatus(checks), checkedAt, environment, deploymentId, commitSha, checks });
}
