import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, type AdminSessionUser } from "@/lib/require-admin";
import { adminUserCreateSchema, adminUserUpdateSchema } from "@/lib/validation";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import type { AdminPermission, AdminRole, AdminUser } from "@/types/store";

async function getActor() {
  return await requireAdmin("users");
}

function unavailable() {
  return NextResponse.json({ error: "Configure a chave de serviço do Supabase para gerenciar usuários." }, { status: 503 });
}

async function listAuthUsers() {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const users = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 200) break;
  }
  return users;
}

async function listUsers(currentUserId: string, tenantId: string): Promise<AdminUser[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const { data: memberships, error: membershipError } = await supabase
    .from("tenant_members")
    .select("user_id, role, permissions, active, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at");
  if (membershipError) throw membershipError;
  const ids = (memberships ?? []).map((membership) => membership.user_id);
  const [{ data: profiles, error: profileError }, authUsers] = await Promise.all([
    ids.length
      ? supabase.from("profiles").select("id, full_name, email, created_at").in("id", ids)
      : Promise.resolve({ data: [], error: null }),
    listAuthUsers(),
  ]);
  if (profileError) throw profileError;
  const profilesById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const authById = new Map(authUsers.map((user) => [user.id, user]));
  return (memberships ?? []).map((membership) => {
    const profile = profilesById.get(membership.user_id);
    const authUser = authById.get(membership.user_id);
    return {
      id: membership.user_id,
      fullName: profile?.full_name || authUser?.user_metadata?.full_name || profile?.email?.split("@")[0] || "Usuário",
      email: profile?.email || authUser?.email || "",
      role: membership.role as AdminRole,
      permissions: (membership.permissions ?? []) as AdminPermission[],
      active: Boolean(membership.active),
      createdAt: membership.created_at || profile?.created_at || authUser?.created_at || "",
      lastSignInAt: authUser?.last_sign_in_at || "",
      isCurrent: membership.user_id === currentUserId,
    };
  });
}

function guard(request: Request, actorId: string) {
  try {
    guardAdminMutation(request, actorId);
    return null;
  } catch (error) {
    if (error instanceof AdminRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
}

function safeMembershipAudit(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const row = value as { role?: unknown; permissions?: unknown; active?: unknown };
  return {
    role: row.role ?? null,
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    active: Boolean(row.active),
  };
}

async function recordUserAudit(actor: AdminSessionUser, action: "insert" | "update" | "delete", userId: string, beforeData?: unknown, afterData?: unknown) {
  const supabase = createAdminClient();
  if (!supabase) return;
  await supabase.from("audit_logs").insert({
    tenant_id: actor.tenantId,
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    entity_type: "tenant_members",
    entity_id: userId,
    entity_label: `Usuário ${userId.slice(0, 8)}`,
    before_data: safeMembershipAudit(beforeData),
    after_data: safeMembershipAudit(afterData),
  });
}

async function isLastOwner(id: string, tenantId: string) {
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { data: target } = await supabase.from("tenant_members").select("role").eq("tenant_id", tenantId).eq("user_id", id).maybeSingle();
  if (target?.role !== "owner") return false;
  const { count } = await supabase.from("tenant_members").select("user_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("role", "owner").eq("active", true);
  return (count ?? 0) <= 1;
}

export async function GET() {
  const actor = await getActor();
  if (!createAdminClient()) return unavailable();
  try {
    return NextResponse.json({ users: await listUsers(actor.id, actor.tenantId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getActor();
  const rejected = guard(request, actor.id);
  if (rejected) return rejected;
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const parsed = adminUserCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados." }, { status: 400 });
  if (parsed.data.role === "owner" && actor.role !== "owner" && !actor.isPlatformAdmin) return NextResponse.json({ error: "Somente o proprietário pode criar outro proprietário." }, { status: 403 });

  const existing = (await listAuthUsers()).find((user) => user.email?.toLowerCase() === parsed.data.email.toLowerCase());
  let authUser = existing;
  let created = false;
  if (!authUser) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      email_confirm: true,
      user_metadata: { full_name: parsed.data.fullName, must_change_password: true },
    });
    if (error || !data.user) return NextResponse.json({ error: "Não foi possível criar o usuário." }, { status: 400 });
    authUser = data.user;
    created = true;
  }

  const [{ error: profileError }, { error: membershipError }] = await Promise.all([
    supabase.from("profiles").upsert({ id: authUser.id, full_name: parsed.data.fullName, email: parsed.data.email, active: true }),
    supabase.from("tenant_members").upsert({ tenant_id: actor.tenantId, user_id: authUser.id, role: parsed.data.role, permissions: parsed.data.permissions, active: parsed.data.active }),
  ]);
  if (profileError || membershipError) {
    if (created) await supabase.auth.admin.deleteUser(authUser.id);
    return NextResponse.json({ error: "A conta foi revertida porque o acesso à loja não pôde ser salvo." }, { status: 500 });
  }
  await recordUserAudit(actor, "insert", authUser.id, null, { role: parsed.data.role, permissions: parsed.data.permissions, active: parsed.data.active });
  return NextResponse.json({ users: await listUsers(actor.id, actor.tenantId) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getActor();
  const rejected = guard(request, actor.id);
  if (rejected) return rejected;
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const parsed = adminUserUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados." }, { status: 400 });
  const { data: membership } = await supabase.from("tenant_members").select("role, permissions, active").eq("tenant_id", actor.tenantId).eq("user_id", parsed.data.id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Usuário não encontrado nesta loja." }, { status: 404 });
  if ((membership.role === "owner" || parsed.data.role === "owner") && actor.role !== "owner" && !actor.isPlatformAdmin) return NextResponse.json({ error: "Somente o proprietário pode alterar este perfil." }, { status: 403 });
  if (parsed.data.id === actor.id && (parsed.data.role !== actor.role || !parsed.data.active)) return NextResponse.json({ error: "Você não pode remover o próprio acesso ou cargo." }, { status: 400 });
  if (membership.role === "owner" && (parsed.data.role !== "owner" || !parsed.data.active) && await isLastOwner(parsed.data.id, actor.tenantId)) return NextResponse.json({ error: "A loja precisa manter ao menos um proprietário ativo." }, { status: 400 });

  const [{ error: membershipError }, { error: profileError }, { error: authError }] = await Promise.all([
    supabase.from("tenant_members").update({ role: parsed.data.role, permissions: parsed.data.permissions, active: parsed.data.active }).eq("tenant_id", actor.tenantId).eq("user_id", parsed.data.id),
    supabase.from("profiles").update({ full_name: parsed.data.fullName }).eq("id", parsed.data.id),
    supabase.auth.admin.updateUserById(parsed.data.id, { user_metadata: { full_name: parsed.data.fullName } }),
  ]);
  if (membershipError || profileError || authError) return NextResponse.json({ error: "Não foi possível atualizar o usuário." }, { status: 500 });
  await recordUserAudit(actor, "update", parsed.data.id, membership, parsed.data);
  return NextResponse.json({ users: await listUsers(actor.id, actor.tenantId) });
}

export async function DELETE(request: Request) {
  const actor = await getActor();
  const rejected = guard(request, actor.id);
  if (rejected) return rejected;
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (id === actor.id) return NextResponse.json({ error: "Você não pode excluir o próprio acesso." }, { status: 400 });
  const { data: membership } = await supabase.from("tenant_members").select("role, permissions, active").eq("tenant_id", actor.tenantId).eq("user_id", id).maybeSingle();
  if (!membership) return NextResponse.json({ error: "Usuário não encontrado nesta loja." }, { status: 404 });
  if (membership.role === "owner" && actor.role !== "owner" && !actor.isPlatformAdmin) return NextResponse.json({ error: "Somente o proprietário pode excluir outro proprietário." }, { status: 403 });
  if (await isLastOwner(id, actor.tenantId)) return NextResponse.json({ error: "A loja precisa manter ao menos um proprietário ativo." }, { status: 400 });
  const { error } = await supabase.from("tenant_members").delete().eq("tenant_id", actor.tenantId).eq("user_id", id);
  if (error) return NextResponse.json({ error: "Não foi possível excluir o acesso." }, { status: 500 });
  await recordUserAudit(actor, "delete", id, membership, null);
  return NextResponse.json({ users: await listUsers(actor.id, actor.tenantId) });
}
