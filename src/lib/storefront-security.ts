import "server-only";

import { createHash, createHmac } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export class StorefrontRequestError extends Error {
  constructor(message: string, readonly status: number, readonly retryAfter = 0) {
    super(message);
  }
}

export function guardStorefrontRequest(request: Request, maxBytes = 24_000) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  const contentLength = Number(request.headers.get("content-length") || 0);

  if (!origin || origin !== url.origin || fetchSite === "cross-site") {
    throw new StorefrontRequestError("Origem da solicitação não permitida.", 403);
  }
  if (contentLength > maxBytes) {
    throw new StorefrontRequestError("Solicitação muito grande.", 413);
  }
}

export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown"
  );
}

export function requestFingerprint(request: Request, tenantId: string) {
  const secret =
    process.env.STOREFRONT_SECURITY_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || "junior-imports-local-security";
  const material = [
    tenantId,
    clientIp(request),
    request.headers.get("user-agent") || "unknown",
  ].join("|");
  return createHmac("sha256", secret).update(material).digest("hex");
}

export function requestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function consumeStorefrontRateLimit(
  supabase: AdminClient,
  input: {
    tenantId: string;
    fingerprint: string;
    action: "order" | "coupon";
    limit: number;
    windowSeconds: number;
  },
) {
  const { data, error } = await supabase.rpc("consume_storefront_rate_limit", {
    p_tenant_id: input.tenantId,
    p_fingerprint_hash: input.fingerprint,
    p_action: input.action,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });
  if (error || !data) throw new StorefrontRequestError("Não foi possível validar a segurança da solicitação.", 503);
  const result = data as { allowed?: boolean; remaining?: number; retry_after?: number };
  if (!result.allowed) {
    throw new StorefrontRequestError(
      "Muitas tentativas em pouco tempo. Aguarde e tente novamente.",
      429,
      Number(result.retry_after) || 60,
    );
  }
  return { remaining: Number(result.remaining) || 0 };
}

export async function verifyTurnstile(request: Request, token: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return;
  if (!token) throw new StorefrontRequestError("Confirme que você não é um robô.", 400);

  const form = new FormData();
  form.set("secret", secret);
  form.set("response", token);
  form.set("remoteip", clientIp(request));

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as { success?: boolean; hostname?: string } | null;
  if (!response.ok || !result?.success) {
    throw new StorefrontRequestError("A verificação de segurança expirou. Tente novamente.", 400);
  }
  const requestHost = new URL(request.url).hostname;
  if (result.hostname && result.hostname !== requestHost && process.env.NODE_ENV === "production") {
    throw new StorefrontRequestError("A verificação de segurança não pertence a esta loja.", 400);
  }
}

export function storefrontErrorResponse(error: unknown) {
  if (error instanceof StorefrontRequestError) {
    return Response.json(
      { error: error.message },
      {
        status: error.status,
        headers: {
          "Cache-Control": "no-store",
          ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}),
        },
      },
    );
  }
  return Response.json(
    { error: "Não foi possível processar a solicitação com segurança." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export function friendlyOrderError(message: string) {
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (normalized.includes("estoque") || normalized.includes("produto indisponível")) {
    return "Um produto ficou indisponível ou não possui a quantidade solicitada.";
  }
  if (normalized.includes("cupom")) {
    return "O cupom não pôde ser utilizado neste pedido.";
  }
  if (normalized.includes("processamento") || normalized.includes("repetição")) {
    return "Este pedido já está sendo processado. Aguarde alguns segundos.";
  }
  if (normalized.includes("cliente") || normalized.includes("e-mail") || normalized.includes("telefone")) {
    return "Revise os dados de contato do cliente.";
  }
  return "Não foi possível registrar o pedido. Revise os dados e tente novamente.";
}
