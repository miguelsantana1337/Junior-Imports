import { z } from "zod";
import { checkoutCustomerSchema } from "@/lib/validation";
import { CHECKOUT_TERMS_VERSION } from "@/lib/checkout-terms";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureEnabled } from "@/lib/feature-flags";
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
    components: z.array(z.string().min(1).max(160)).max(50).optional(),
  })).min(1).max(50),
  payment: z.enum(["Pix", "Cartao", "Dinheiro"]),
  termsAccepted: z.literal(true),
  couponCode: z.string().trim().max(30),
  idempotencyKey: z.string().uuid(),
  botField: z.string().max(0),
  startedAt: z.coerce.number().int().positive(),
  turnstileToken: z.string().max(4096),
  cartSessionId: z.string().uuid().optional(),
  referralCode: z.string().trim().max(24).optional(),
  attribution: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
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
    const usesBundle = parsed.data.items.some((item) => Boolean(item.components?.length));
    if (usesBundle && !await featureEnabled(supabase, { tenantId: parsed.data.tenantId, key: "configurable_bundles", subject: fingerprint })) {
      throw new StorefrontRequestError("A montagem de kits está temporariamente indisponível.", 503);
    }
    if (parsed.data.referralCode && !await featureEnabled(supabase, { tenantId: parsed.data.tenantId, key: "referral_program", subject: fingerprint })) {
      throw new StorefrontRequestError("O programa de indicação está temporariamente indisponível.", 503);
    }
    const funnelEnabled = await featureEnabled(supabase, { tenantId: parsed.data.tenantId, key: "conversion_funnel", subject: fingerprint });
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
      referralCode: parsed.data.referralCode?.toUpperCase() ?? "",
      components: parsed.data.items.map((item) => item.components ?? []),
      termsVersion: CHECKOUT_TERMS_VERSION,
    });
    const orderCustomer = {
      ...parsed.data.customer,
      termsAcceptedAt: new Date().toISOString(),
      termsVersion: CHECKOUT_TERMS_VERSION,
    };
    const { data, error } = await supabase.rpc("create_tenant_order_with_promotions_secure", {
      p_tenant_id: parsed.data.tenantId,
      p_customer: orderCustomer,
      p_items: parsed.data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity, components: item.components ?? [] })),
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
    const order = data as { id?: string };
    if (funnelEnabled && parsed.data.cartSessionId && order.id) {
      await supabase.from("orders").update({ funnel_session_id: parsed.data.cartSessionId, attribution: parsed.data.attribution ?? {} })
        .eq("tenant_id", parsed.data.tenantId).eq("id", order.id);
      await supabase.from("storefront_funnel_events").upsert({
        tenant_id: parsed.data.tenantId,
        session_id: parsed.data.cartSessionId,
        event_key: `order_registered:${order.id}`,
        stage: "order_registered",
        order_id: order.id,
        source: parsed.data.attribution ?? {},
        properties: { total: Number((data as { total?: number }).total) || 0 },
      }, { onConflict: "tenant_id,session_id,event_key", ignoreDuplicates: true });
      await supabase.from("storefront_cart_sessions").update({
        status: "recovered",
        recovered_at: new Date().toISOString(),
        recovered_order_id: order.id,
        updated_at: new Date().toISOString(),
      }).eq("tenant_id", parsed.data.tenantId).eq("session_id", parsed.data.cartSessionId);
    }
    let referralWarning = "";
    if (parsed.data.referralCode && order.id) {
      const referral = await supabase.rpc("attach_referral_to_order", { p_tenant_id: parsed.data.tenantId, p_order_id: order.id, p_code: parsed.data.referralCode });
      if (referral.error) referralWarning = friendlyOrderError(referral.error.message) || "A indicação não pôde ser vinculada.";
    }
    const { data: authoritativeOrder, error: authoritativeOrderError } = order.id
      ? await supabase.from("orders")
        .select("id, customer_id, code, created_at, subtotal, discount, shipping, total, cashback_total, loyalty_discount, campaign_gift, promotion_discount, promotion_snapshot, status, order_source, reservation_expires_at, shipping_status")
        .eq("tenant_id", parsed.data.tenantId)
        .eq("id", order.id)
        .maybeSingle()
      : { data: null, error: null };
    if (authoritativeOrderError) {
      throw new StorefrontRequestError("O pedido foi registrado, mas não foi possível confirmar os benefícios da campanha.", 503);
    }
    return Response.json({ order: authoritativeOrder ?? data, referralWarning }, {
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
