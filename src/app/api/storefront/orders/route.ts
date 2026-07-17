import { z } from "zod";
import { checkoutCustomerSchema } from "@/lib/validation";
import { CHECKOUT_TERMS_VERSION } from "@/lib/checkout-terms";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeStorefrontRateLimit,
  friendlyOrderError,
  guardStorefrontRequest,
  requestFingerprint,
  requestHash,
  StorefrontRequestError,
  storefrontErrorResponse,
  verifyTurnstile,
} from "@/lib/storefront-security";

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  customer: checkoutCustomerSchema,
  items: z.array(z.object({
    productId: z.string().min(1).max(160),
    quantity: z.coerce.number().int().min(1).max(100),
  })).min(1).max(50),
  payment: z.enum(["Pix", "Cartao", "Boleto"]),
  termsAccepted: z.literal(true),
  couponCode: z.string().trim().max(30),
  idempotencyKey: z.string().uuid(),
  botField: z.string().max(0),
  startedAt: z.coerce.number().int().positive(),
  turnstileToken: z.string().max(4096),
});

export async function POST(request: Request) {
  try {
    guardStorefrontRequest(request);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StorefrontRequestError("Revise os dados do pedido.", 400);
    const elapsed = Date.now() - parsed.data.startedAt;
    if (parsed.data.botField || elapsed < 1_200 || elapsed > 2 * 60 * 60 * 1000) {
      throw new StorefrontRequestError("Não foi possível validar esta solicitação.", 400);
    }

    await verifyTurnstile(request, parsed.data.turnstileToken);
    const supabase = createAdminClient();
    if (!supabase) throw new StorefrontRequestError("O banco de dados não está disponível.", 503);

    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", parsed.data.tenantId)
      .in("status", ["trial", "active"])
      .maybeSingle();
    if (!tenant) throw new StorefrontRequestError("Loja indisponível.", 404);

    const fingerprint = requestFingerprint(request, parsed.data.tenantId);
    const rate = await consumeStorefrontRateLimit(supabase, {
      tenantId: parsed.data.tenantId,
      fingerprint,
      action: "order",
      limit: 5,
      windowSeconds: 600,
    });
    const hash = requestHash({
      tenantId: parsed.data.tenantId,
      customer: parsed.data.customer,
      items: parsed.data.items,
      payment: parsed.data.payment,
      couponCode: parsed.data.couponCode.toUpperCase(),
      termsVersion: CHECKOUT_TERMS_VERSION,
    });
    const orderCustomer = {
      ...parsed.data.customer,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: CHECKOUT_TERMS_VERSION,
    };
    const { data, error } = await supabase.rpc("create_tenant_order_secure", {
      p_tenant_id: parsed.data.tenantId,
      p_customer: orderCustomer,
      p_items: parsed.data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      p_payment: parsed.data.payment,
      p_coupon_code: parsed.data.couponCode,
      p_idempotency_key: parsed.data.idempotencyKey,
      p_request_hash: hash,
      p_fingerprint_hash: fingerprint,
      p_source: "storefront",
      p_reservation_minutes: 30,
    });
    if (error || !data) {
      throw new StorefrontRequestError(friendlyOrderError(error?.message || ""), 400);
    }
    return Response.json({ order: data }, {
      status: 201,
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
