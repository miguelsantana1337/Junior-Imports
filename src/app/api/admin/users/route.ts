import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { adminUserCreateSchema, adminUserUpdateSchema } from "@/lib/validation";
import type { AdminPermission, AdminRole, AdminUser } from "@/types/store";

async function getActor() {
  return await requireAdmin("users");
}

function unavailable() {
  return NextResponse.json({ error: "Configure a chave de serviço do Supabase para gerenciar usuários." }, { status: 503 });
}

async function listUsers(currentUserId: string): Promise<AdminUser[]> {
  const supabase = createAdminClient();
  if (!supabase) return [];
  const [{ data: profiles, error: profileError }, { data: authData, error: authError }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, role, permissions, active, created_at").order("created_at"),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (profileError) throw profileError;
  if (authError) throw authError;
  const authById = new Map(authData.users.map((user) => [user.id, user]));
  return (profiles ?? []).map((profile) => {
    const authUser = authById.get(profile.id);
    return {
      id: profile.id,
      fullName: profile.full_name || authUser?.user_metadata?.full_name || profile.email?.split("@")[0] || "Usuário",
      email: profile.email || authUser?.email || "",
      role: profile.role as AdminRole,
      permissions: (profile.permissions ?? []) as AdminPermission[],
      active: Boolean(profile.active),
      createdAt: profile.created_at || authUser?.created_at || "",
      lastSignInAt: authUser?.last_sign_in_at || "",
      isCurrent: profile.id === currentUserId,
    };
  });
}

async function isLastOwner(id: string) {
  const supabase = createAdminClient();
  if (!supabase) return false;
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (target?.role !== "owner") return false;
  const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "owner").eq("active", true);
  return (count ?? 0) <= 1;
}

export async function GET() {
  const actor = await getActor();
  if (!createAdminClient()) return unavailable();
  try {
    return NextResponse.json({ users: await listUsers(actor.id) });
  } catch {
    return NextResponse.json({ error: "Não foi possível carregar os usuários." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await getActor();
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const parsed = adminUserCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados." }, { status: 400 });
  if (parsed.data.role === "owner" && actor.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode criar outro proprietário." }, { status: 403 });

  const { data, error } = await supabase.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error || !data.user) {
    const duplicate = error?.message.toLowerCase().includes("already") || error?.message.toLowerCase().includes("registered");
    return NextResponse.json({ error: duplicate ? "Já existe uma conta com este e-mail." : "Não foi possível criar o usuário." }, { status: 400 });
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    role: parsed.data.role,
    permissions: parsed.data.permissions,
    active: parsed.data.active,
  });
  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: "A conta foi revertida porque as permissões não puderam ser salvas." }, { status: 500 });
  }
  return NextResponse.json({ users: await listUsers(actor.id) }, { status: 201 });
}

export async function PATCH(request: Request) {
  const actor = await getActor();
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const parsed = adminUserUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados." }, { status: 400 });
  const { data: target } = await supabase.from("profiles").select("role, active").eq("id", parsed.data.id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if ((target.role === "owner" || parsed.data.role === "owner") && actor.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode alterar este perfil." }, { status: 403 });
  if (parsed.data.id === actor.id && (parsed.data.role !== actor.role || !parsed.data.active)) return NextResponse.json({ error: "Você não pode remover o próprio acesso ou cargo." }, { status: 400 });
  if (target.role === "owner" && (parsed.data.role !== "owner" || !parsed.data.active) && await isLastOwner(parsed.data.id)) return NextResponse.json({ error: "A loja precisa manter ao menos um proprietário ativo." }, { status: 400 });

  const [{ error: profileError }, { error: authError }] = await Promise.all([
    supabase.from("profiles").update({ full_name: parsed.data.fullName, role: parsed.data.role, permissions: parsed.data.permissions, active: parsed.data.active }).eq("id", parsed.data.id),
    supabase.auth.admin.updateUserById(parsed.data.id, { user_metadata: { full_name: parsed.data.fullName } }),
  ]);
  if (profileError || authError) return NextResponse.json({ error: "Não foi possível atualizar o usuário." }, { status: 500 });
  return NextResponse.json({ users: await listUsers(actor.id) });
}

export async function DELETE(request: Request) {
  const actor = await getActor();
  const supabase = createAdminClient();
  if (!supabase) return unavailable();
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (id === actor.id) return NextResponse.json({ error: "Você não pode excluir a própria conta." }, { status: 400 });
  const { data: target } = await supabase.from("profiles").select("role").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  if (target.role === "owner" && actor.role !== "owner") return NextResponse.json({ error: "Somente o proprietário pode excluir outro proprietário." }, { status: 403 });
  if (await isLastOwner(id)) return NextResponse.json({ error: "A loja precisa manter ao menos um proprietário ativo." }, { status: 400 });
  const { error } = await supabase.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: "Não foi possível excluir o usuário." }, { status: 500 });
  return NextResponse.json({ users: await listUsers(actor.id) });
}
