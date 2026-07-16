import { platformConfig } from "@/config/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  consumeStorefrontRateLimit,
  guardStorefrontRequest,
  requestFingerprint,
  StorefrontRequestError,
  storefrontErrorResponse,
} from "@/lib/storefront-security";
import { passwordRecoveryRequestSchema } from "@/lib/validation";

const genericMessage = "Se o e-mail estiver cadastrado e ativo, você receberá um código de 6 dígitos.";

export async function POST(request: Request) {
  try {
    guardStorefrontRequest(request, 4_000);
    const parsed = passwordRecoveryRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StorefrontRequestError(parsed.error.issues[0]?.message ?? "Informe um e-mail válido.", 400);

    const admin = createAdminClient();
    if (!admin) throw new StorefrontRequestError("Recuperação de senha indisponível no momento.", 503);
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", platformConfig.clientId)
      .in("status", ["trial", "active"])
      .maybeSingle();
    if (tenantError || !tenant) throw new StorefrontRequestError("Recuperação de senha indisponível no momento.", 503);

    const rate = await consumeStorefrontRateLimit(admin, {
      tenantId: tenant.id,
      fingerprint: requestFingerprint(request, `${tenant.id}:${parsed.data.email}`),
      action: "password_reset",
      limit: 2,
      windowSeconds: 60 * 60,
    });

    const { data: profile } = await admin
      .from("profiles")
      .select("id, active")
      .ilike("email", parsed.data.email)
      .maybeSingle();

    if (profile?.active) {
      const supabase = await createClient();
      if (supabase) {
        await supabase.auth.resetPasswordForEmail(parsed.data.email, {
          redirectTo: `${platformConfig.siteUrl}/admin/auth/callback?next=/admin/reset-password`,
        });
      }
    }

    return Response.json(
      { ok: true, message: genericMessage },
      {
        headers: {
          "Cache-Control": "no-store",
          "X-RateLimit-Remaining": String(rate.remaining),
        },
      },
    );
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
