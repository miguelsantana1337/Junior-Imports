import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { featureEnabled } from "@/lib/feature-flags";
import { guardStorefrontRequest, StorefrontRequestError, storefrontErrorResponse } from "@/lib/storefront-security";

const querySchema = z.object({ tenantId: z.string().uuid(), code: z.string().trim().min(4).max(24) });

export async function GET(request: Request) {
  try {
    guardStorefrontRequest(request, 8_000);
    const url = new URL(request.url);
    const input = querySchema.parse({ tenantId: url.searchParams.get("tenantId"), code: url.searchParams.get("code") });
    const supabase = createAdminClient();
    if (!supabase) throw new StorefrontRequestError("Validação indisponível.", 503);
    if (!await featureEnabled(supabase, { tenantId: input.tenantId, key: "referral_program", subject: input.code })) {
      return Response.json({ valid: false, campaignName: "" }, { headers: { "Cache-Control": "no-store" } });
    }
    const now = new Date().toISOString();
    const { data: code } = await supabase.from("referral_codes").select("id")
      .eq("tenant_id", input.tenantId).ilike("code", input.code).eq("status", "active")
      .or(`expires_at.is.null,expires_at.gt.${now}`).maybeSingle();
    const { data: campaign } = await supabase.from("referral_campaigns").select("id,name")
      .eq("tenant_id", input.tenantId).eq("status", "active").lte("starts_at", now)
      .or(`ends_at.is.null,ends_at.gte.${now}`).limit(1).maybeSingle();
    return Response.json({ valid: Boolean(code && campaign), campaignName: campaign?.name ?? "" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("[storefront/referrals] validation failed", {
      status: error instanceof StorefrontRequestError ? error.status : 500,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return storefrontErrorResponse(error);
  }
}
