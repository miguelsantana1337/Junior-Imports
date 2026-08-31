import { NextResponse } from "next/server";
import { z } from "zod";
import { adminNotificationCategories } from "@/lib/admin-preferences";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const categorySchema = z.enum(adminNotificationCategories as [string, ...string[]]);
const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string().min(16).max(512),
    auth: z.string().min(8).max(256),
  }),
  categories: z.array(categorySchema).max(adminNotificationCategories.length),
  deviceLabel: z.string().trim().max(120).optional(),
});
const removeSchema = z.object({ endpoint: z.string().url().max(2048) });

function response(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function guarded(request: Request, actorId: string) {
  try {
    guardAdminMutation(request, actorId, 20, 60_000);
    return null;
  } catch (error) {
    if (error instanceof AdminRequestError) return response({ error: error.message }, error.status);
    return response({ error: "Solicitação inválida." }, 400);
  }
}

export async function POST(request: Request) {
  const actor = await requireAdmin();
  const blocked = guarded(request, actor.id);
  if (blocked) return blocked;
  const parsed = subscriptionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "A inscrição deste aparelho é inválida." }, 400);
  const client = createAdminClient();
  if (!client) return response({ error: "Serviço de notificações indisponível." }, 503);

  const { data, error } = await client.from("admin_push_subscriptions").upsert({
    tenant_id: actor.tenantId,
    user_id: actor.id,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth_secret: parsed.data.keys.auth,
    categories: [...new Set(parsed.data.categories)],
    device_label: parsed.data.deviceLabel ?? "",
    user_agent: request.headers.get("user-agent")?.slice(0, 512) ?? "",
    active: true,
    failure_count: 0,
    last_failure_at: null,
  }, { onConflict: "tenant_id,user_id,endpoint" }).select("id, active, updated_at").single();
  if (error || !data) return response({ error: "Não foi possível ativar as notificações neste aparelho." }, 503);

  return response({ ok: true, subscription: { id: data.id, active: data.active, updatedAt: data.updated_at } });
}

export async function DELETE(request: Request) {
  const actor = await requireAdmin();
  const blocked = guarded(request, actor.id);
  if (blocked) return blocked;
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return response({ error: "Inscrição inválida." }, 400);
  const client = createAdminClient();
  if (!client) return response({ error: "Serviço de notificações indisponível." }, 503);

  const { error } = await client.from("admin_push_subscriptions")
    .delete()
    .eq("tenant_id", actor.tenantId)
    .eq("user_id", actor.id)
    .eq("endpoint", parsed.data.endpoint);
  if (error) return response({ error: "Não foi possível desativar as notificações." }, 503);
  return response({ ok: true });
}
