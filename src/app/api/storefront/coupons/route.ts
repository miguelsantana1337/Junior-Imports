import { z } from "zod";
import { cloneSeedData } from "@/data/seed";
import { calculateCart } from "@/lib/commerce";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consumeStorefrontRateLimit,
  guardStorefrontRequest,
  requestFingerprint,
  StorefrontRequestError,
  storefrontErrorResponse,
} from "@/lib/storefront-security";

const requestSchema = z.object({
  tenantId: z.string().uuid(),
  code: z.string().trim().min(3).max(30),
  items: z.array(z.object({
    productId: z.string().min(1).max(160),
    quantity: z.coerce.number().int().min(1).max(100),
  })).min(1).max(50),
});

export async function POST(request: Request) {
  try {
    guardStorefrontRequest(request, 12_000);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StorefrontRequestError("Revise o cupom e o carrinho.", 400);

    const supabase = createAdminClient();
    if (!supabase) {
      const fallback = cloneSeedData();
      const coupon = fallback.coupons.find((item) => item.code.toUpperCase() === parsed.data.code.toUpperCase()) ?? null;
      const lines = parsed.data.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
      const result = calculateCart(lines, fallback.products, fallback.settings, coupon, undefined, fallback.cashbackCampaigns);
      if (!coupon || result.couponDiscount <= 0) {
        return Response.json({ valid: false, message: "Cupom inválido ou expirado." }, { headers: { "Cache-Control": "no-store" } });
      }
      return Response.json(
        { valid: true, code: coupon.code, discount: result.couponDiscount, subtotal: result.subtotal },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const fingerprint = requestFingerprint(request, parsed.data.tenantId);
    const rate = await consumeStorefrontRateLimit(supabase, {
      tenantId: parsed.data.tenantId,
      fingerprint,
      action: "coupon",
      limit: 20,
      windowSeconds: 600,
    });
    const { data, error } = await supabase.rpc("validate_storefront_coupon", {
      p_tenant_id: parsed.data.tenantId,
      p_items: parsed.data.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
      p_coupon_code: parsed.data.code,
      p_email: "",
      p_phone: "",
    });
    if (error || !data) throw new StorefrontRequestError("Não foi possível validar este cupom.", 400);
    return Response.json(data, {
      headers: {
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
