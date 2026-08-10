import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeStorefrontRateLimit,
  guardStorefrontRequest,
  requestFingerprint,
  StorefrontRequestError,
  storefrontErrorResponse,
} from "@/lib/storefront-security";

const eventSchema = z.object({
  tenantId: z.string().uuid(),
  sessionId: z.string().uuid(),
  eventKey: z.string().trim().min(3).max(160),
  stage: z.enum(["product_viewed", "added_to_cart", "checkout_started", "order_registered", "whatsapp_opened", "partial_payment", "paid", "delivered"]),
  productId: z.string().max(160).optional(),
  orderId: z.string().max(160).optional(),
  source: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  properties: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export async function POST(request: Request) {
  try {
    guardStorefrontRequest(request, 18_000);
    const parsed = eventSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StorefrontRequestError("Evento inválido.", 400);
    const supabase = createAdminClient();
    if (!supabase) throw new StorefrontRequestError("Medição indisponível.", 503);
    const input = parsed.data;
    await consumeStorefrontRateLimit(supabase, {
      tenantId: input.tenantId,
      fingerprint: requestFingerprint(request, input.tenantId),
      action: "funnel_event",
      limit: 180,
      windowSeconds: 600,
    });
    const { error } = await supabase.from("storefront_funnel_events").upsert({
      tenant_id: input.tenantId,
      session_id: input.sessionId,
      event_key: input.eventKey,
      stage: input.stage,
      product_id: input.productId || null,
      order_id: input.orderId || null,
      source: input.source ?? {},
      properties: input.properties ?? {},
      occurred_at: new Date().toISOString(),
    }, { onConflict: "tenant_id,session_id,event_key", ignoreDuplicates: true });
    if (error) throw new StorefrontRequestError("Medição indisponível.", 503);
    return Response.json({ tracked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
