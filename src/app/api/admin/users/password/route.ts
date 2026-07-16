import { NextResponse } from "next/server";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminUserPasswordResetSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const actor = await requireAdmin("users");
  try {
    guardAdminMutation(request, actor.id, 10);
  } catch (error) {
    if (error instanceof AdminRequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  const parsed = adminUserPasswordResetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise a nova senha." },
      { status: 400 },
    );
  }
  if (parsed.data.id === actor.id) {
    return NextResponse.json(
      { error: "Use a opção “Alterar minha senha” para proteger sua própria conta." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("tenant_members")
    .select("role, active")
    .eq("tenant_id", actor.tenantId)
    .eq("user_id", parsed.data.id)
    .maybeSingle();
  if (membershipError || !membership) {
    return NextResponse.json({ error: "Usuário não encontrado nesta loja." }, { status: 404 });
  }
  if (membership.role === "owner" && actor.role !== "owner" && !actor.isPlatformAdmin) {
    return NextResponse.json(
      { error: "Somente o proprietário pode redefinir a senha de outro proprietário." },
      { status: 403 },
    );
  }

  const { data: authResult, error: authReadError } = await supabase.auth.admin.getUserById(parsed.data.id);
  if (authReadError || !authResult.user) {
    return NextResponse.json({ error: "A conta de autenticação não foi encontrada." }, { status: 404 });
  }
  const { data: profile, error: profileReadError } = await supabase
    .from("profiles")
    .select("must_change_password")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (profileReadError || !profile) {
    return NextResponse.json({ error: "O perfil de segurança não foi encontrado." }, { status: 404 });
  }

  const { error: profileLockError } = await supabase
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", parsed.data.id);
  if (profileLockError) {
    return NextResponse.json({ error: "Não foi possível preparar a troca obrigatória." }, { status: 500 });
  }

  const { error: passwordError } = await supabase.auth.admin.updateUserById(parsed.data.id, {
    password: parsed.data.password,
    user_metadata: {
      ...authResult.user.user_metadata,
      must_change_password: true,
    },
  });
  if (passwordError) {
    await supabase
      .from("profiles")
      .update({ must_change_password: Boolean(profile.must_change_password) })
      .eq("id", parsed.data.id);
    return NextResponse.json({ error: "Não foi possível redefinir a senha." }, { status: 400 });
  }

  await supabase.from("audit_logs").insert({
    tenant_id: actor.tenantId,
    actor_id: actor.id,
    actor_email: actor.email,
    action: "update",
    entity_type: "tenant_members",
    entity_id: parsed.data.id,
    entity_label: `Usuário ${parsed.data.id.slice(0, 8)}`,
    before_data: { password_reset_required: Boolean(profile.must_change_password) },
    after_data: {
      password_reset_required: true,
      access_active: Boolean(membership.active),
    },
  });

  return NextResponse.json(
    { ok: true, message: "Senha temporária definida. A troca será obrigatória no próximo acesso." },
    { headers: { "Cache-Control": "no-store" } },
  );
}
