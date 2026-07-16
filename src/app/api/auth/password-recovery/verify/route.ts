import { cookies } from "next/headers";
import { platformConfig } from "@/config/platform";
import {
  issuePasswordRecoveryProof,
  passwordRecoveryCookie,
  passwordRecoveryCookieOptions,
} from "@/lib/password-recovery-session";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  consumeStorefrontRateLimit,
  guardStorefrontRequest,
  requestFingerprint,
  StorefrontRequestError,
  storefrontErrorResponse,
} from "@/lib/storefront-security";
import { passwordRecoveryVerifySchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    guardStorefrontRequest(request, 4_000);
    const parsed = passwordRecoveryVerifySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StorefrontRequestError(parsed.error.issues[0]?.message ?? "Revise o código.", 400);

    const admin = createAdminClient();
    if (!admin) throw new StorefrontRequestError("Recuperação de senha indisponível no momento.", 503);
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", platformConfig.clientId)
      .in("status", ["trial", "active"])
      .maybeSingle();
    if (tenantError || !tenant) throw new StorefrontRequestError("Recuperação de senha indisponível no momento.", 503);

    await consumeStorefrontRateLimit(admin, {
      tenantId: tenant.id,
      fingerprint: requestFingerprint(request, `${tenant.id}:${parsed.data.email}`),
      action: "password_verify",
      limit: 8,
      windowSeconds: 15 * 60,
    });

    const supabase = await createClient();
    if (!supabase) throw new StorefrontRequestError("Recuperação de senha indisponível no momento.", 503);
    const { data, error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.code,
      type: "recovery",
    });
    if (error || !data.user || data.user.email?.toLowerCase() !== parsed.data.email) {
      throw new StorefrontRequestError("Código inválido ou expirado. Solicite um novo código.", 400);
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (!profile?.active) {
      await supabase.auth.signOut({ scope: "local" });
      throw new StorefrontRequestError("Código inválido ou expirado. Solicite um novo código.", 400);
    }

    const cookieStore = await cookies();
    cookieStore.set(
      passwordRecoveryCookie,
      issuePasswordRecoveryProof(data.user.id),
      passwordRecoveryCookieOptions,
    );

    return Response.json(
      { ok: true, redirectTo: "/admin/reset-password" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
