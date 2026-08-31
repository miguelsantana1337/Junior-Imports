import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { sendAdminPush } from "@/lib/admin-push";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireAdmin();
  try {
    guardAdminMutation(request, actor.id, 5, 60_000);
  } catch (error) {
    const status = error instanceof AdminRequestError ? error.status : 400;
    const message = error instanceof AdminRequestError ? error.message : "Solicitação inválida.";
    return NextResponse.json({ error: message }, { status });
  }
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Serviço de notificações indisponível." }, { status: 503 });
  const result = await sendAdminPush(client, actor.tenantId, {
    notificationKey: `push-test:${actor.id}:${randomUUID()}`,
    category: "system",
    priority: "important",
    title: "Notificações ativadas",
    body: "Este aparelho já pode receber os alertas importantes da Junior Imports.",
    href: "/admin",
  }, { targetUserId: actor.id });
  if (!result.configured) return NextResponse.json({ error: "O servidor de notificações ainda não foi configurado." }, { status: 503 });
  if (!result.sent) return NextResponse.json({ error: "Nenhuma inscrição ativa foi encontrada para este aparelho." }, { status: 409 });
  return NextResponse.json({ ok: true, sent: result.sent }, { headers: { "Cache-Control": "private, no-store" } });
}
