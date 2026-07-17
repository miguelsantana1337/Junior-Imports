import "server-only";

import { headers } from "next/headers";
import { platformConfig } from "@/config/platform";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  clearStorefrontRateLimit,
  consumeStorefrontRateLimit,
  requestFingerprintFromHeaders,
  StorefrontRequestError,
} from "@/lib/storefront-security";

const loginWindowSeconds = 15 * 60;

type LoginRateLimitContext = {
  tenantId: string;
  fingerprints: string[];
};

type LoginRateLimitResult =
  | { allowed: true; context: LoginRateLimitContext }
  | { allowed: false; error: string };

export async function enforceAdminLoginRateLimit(
  email: string,
): Promise<LoginRateLimitResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      allowed: false,
      error: "O controle de segurança do login está indisponível. Tente novamente em instantes.",
    };
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", platformConfig.clientId)
    .maybeSingle();
  if (tenantError || !tenant) {
    return {
      allowed: false,
      error: "O controle de segurança do login está indisponível. Tente novamente em instantes.",
    };
  }

  const requestHeaders = await headers();
  const normalizedEmail = email.trim().toLowerCase();
  const fingerprints = [
    requestFingerprintFromHeaders(requestHeaders, "admin-login:ip"),
    requestFingerprintFromHeaders(
      requestHeaders,
      `admin-login:identity:${normalizedEmail}`,
    ),
  ];

  try {
    await consumeStorefrontRateLimit(admin, {
      tenantId: tenant.id,
      fingerprint: fingerprints[0],
      action: "login",
      limit: 30,
      windowSeconds: loginWindowSeconds,
    });
    await consumeStorefrontRateLimit(admin, {
      tenantId: tenant.id,
      fingerprint: fingerprints[1],
      action: "login",
      limit: 8,
      windowSeconds: loginWindowSeconds,
    });
  } catch (caught) {
    if (caught instanceof StorefrontRequestError && caught.status === 429) {
      const minutes = Math.max(1, Math.ceil(caught.retryAfter / 60));
      return {
        allowed: false,
        error: `Muitas tentativas de acesso. Aguarde cerca de ${minutes} ${minutes === 1 ? "minuto" : "minutos"} e tente novamente.`,
      };
    }
    return {
      allowed: false,
      error: "Não foi possível validar a segurança do login. Tente novamente em instantes.",
    };
  }

  return {
    allowed: true,
    context: { tenantId: tenant.id, fingerprints },
  };
}

export async function clearAdminLoginRateLimit(
  context: LoginRateLimitContext,
) {
  const admin = createAdminClient();
  if (!admin) return;

  await Promise.allSettled(
    context.fingerprints.map((fingerprint) =>
      clearStorefrontRateLimit(admin, {
        tenantId: context.tenantId,
        fingerprint,
        action: "login",
      }),
    ),
  );
}
