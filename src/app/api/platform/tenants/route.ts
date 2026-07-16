import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { guardAdminMutation, AdminRequestError } from "@/lib/admin-request-guard";
import { requirePlatformAdmin } from "@/lib/require-platform-admin";
import { tenantCreateSchema, tenantUpdateSchema } from "@/lib/validation";
import type { SaasTenant } from "@/types/store";

function unavailable() {
  return NextResponse.json({ error: "Configure o Supabase e a chave de serviço para administrar o SaaS." }, { status: 503 });
}

function mapTenant(row: Record<string, unknown>): SaasTenant {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    status: row.status as SaasTenant["status"],
    plan: row.plan as SaasTenant["plan"],
    primaryDomain: String(row.primary_domain ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

async function actorOrResponse() {
  try {
    return await requirePlatformAdmin();
  } catch {
    return NextResponse.json({ error: "Acesso restrito ao administrador da plataforma." }, { status: 403 });
  }
}

function guard(request: Request, actorId: string) {
  try {
    guardAdminMutation(request, actorId, 12);
    return null;
  } catch (error) {
    if (error instanceof AdminRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
}

export async function GET() {
  const actor = await actorOrResponse();
  if (actor instanceof NextResponse) return actor;
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const { data, error } = await supabase.from("tenants").select("id, slug, name, status, plan, primary_domain, created_at").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Não foi possível carregar os clientes." }, { status: 500 });
  return NextResponse.json({ tenants: (data ?? []).map((row) => mapTenant(row as Record<string, unknown>)) });
}

export async function POST(request: Request) {
  const actor = await actorOrResponse();
  if (actor instanceof NextResponse) return actor;
  const rejected = guard(request, actor.id);
  if (rejected) return rejected;
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const parsed = tenantCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados." }, { status: 400 });

  const input = parsed.data;
  let ownerId = "";
  let createdOwner = false;
  const created = await supabase.auth.admin.createUser({
    email: input.ownerEmail,
    password: input.ownerPassword,
    email_confirm: true,
    user_metadata: { full_name: input.ownerName, must_change_password: true },
  });

  if (created.data.user) {
    ownerId = created.data.user.id;
    createdOwner = true;
  } else {
    const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    ownerId = users.data.users.find((user) => user.email?.toLowerCase() === input.ownerEmail.toLowerCase())?.id ?? "";
    if (!ownerId) return NextResponse.json({ error: "Não foi possível criar o responsável da loja." }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: ownerId,
    full_name: input.ownerName,
    email: input.ownerEmail,
    role: "viewer",
    permissions: ["dashboard"],
    active: true,
    must_change_password: true,
    is_platform_admin: false,
  });
  if (profileError) {
    if (createdOwner) await supabase.auth.admin.deleteUser(ownerId);
    return NextResponse.json({ error: "Não foi possível preparar o perfil do responsável." }, { status: 500 });
  }

  const { data: tenantId, error } = await supabase.rpc("provision_tenant", {
    p_name: input.name,
    p_slug: input.slug,
    p_whatsapp: input.whatsapp,
    p_email: input.email,
    p_primary_color: input.primaryColor,
    p_order_prefix: input.orderPrefix,
    p_owner_id: ownerId,
  });
  if (error || !tenantId) {
    if (createdOwner) await supabase.auth.admin.deleteUser(ownerId);
    const duplicate = error?.message.toLowerCase().includes("duplicate");
    return NextResponse.json({ error: duplicate ? "Já existe um cliente com este endereço." : "Não foi possível provisionar a nova loja." }, { status: 400 });
  }

  return NextResponse.json({ id: tenantId, slug: input.slug }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await actorOrResponse();
  if (actor instanceof NextResponse) return actor;
  const rejected = guard(request, actor.id);
  if (rejected) return rejected;
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const parsed = tenantUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Revise o status e o plano." }, { status: 400 });
  const { error } = await supabase.from("tenants").update({ status: parsed.data.status, plan: parsed.data.plan, updated_at: new Date().toISOString() }).eq("id", parsed.data.id);
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o cliente." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
