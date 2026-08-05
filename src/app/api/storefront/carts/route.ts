import { z } from "zod";
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
  sessionId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().min(1).max(160),
    quantity: z.coerce.number().int().min(1).max(100),
  })).max(50),
  checkoutStarted: z.boolean().optional(),
  contactAllowed: z.boolean().optional(),
  customer: z.object({
    name: z.string().trim().max(160),
    phone: z.string().trim().max(30),
    email: z.union([z.literal(""), z.string().trim().email()]),
  }).optional(),
}).superRefine((value, context) => {
  if (value.contactAllowed && (!value.customer || !/^\D*(?:\d\D*){10,13}$/.test(value.customer.phone))) {
    context.addIssue({ code: "custom", path: ["customer", "phone"], message: "Contato inválido." });
  }
});

export async function POST(request: Request) {
  try {
    guardStorefrontRequest(request, 18_000);
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new StorefrontRequestError("Não foi possível atualizar o carrinho.", 400);

    const supabase = createAdminClient();
    if (!supabase) throw new StorefrontRequestError("O acompanhamento do carrinho está indisponível.", 503);
    const input = parsed.data;
    const { data: tenant } = await supabase.from("tenants").select("id").eq("id", input.tenantId).in("status", ["trial", "active"]).maybeSingle();
    if (!tenant) throw new StorefrontRequestError("Loja indisponível.", 404);

    await consumeStorefrontRateLimit(supabase, {
      tenantId: input.tenantId,
      fingerprint: requestFingerprint(request, input.tenantId),
      action: "cart",
      limit: 90,
      windowSeconds: 600,
    });

    if (!input.items.length) {
      await supabase.from("storefront_cart_sessions").delete()
        .eq("tenant_id", input.tenantId)
        .eq("session_id", input.sessionId)
        .neq("status", "recovered");
      return Response.json({ tracked: false }, { headers: { "Cache-Control": "no-store" } });
    }

    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const { data: productRows, error: productError } = await supabase.from("products")
      .select("id, name, price, active")
      .eq("tenant_id", input.tenantId)
      .in("id", productIds);
    if (productError) throw new StorefrontRequestError("Não foi possível atualizar o carrinho.", 503);

    const products = new Map((productRows ?? []).filter((product) => product.active).map((product) => [String(product.id), product]));
    const items = input.items.flatMap((item) => {
      const product = products.get(item.productId);
      return product ? [{
        product_id: item.productId,
        name: String(product.name),
        quantity: item.quantity,
        unit_price: Number(product.price) || 0,
      }] : [];
    });
    if (!items.length) throw new StorefrontRequestError("O carrinho não possui produtos disponíveis.", 400);

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      tenant_id: input.tenantId,
      session_id: input.sessionId,
      status: "active",
      items,
      item_count: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
      last_activity_at: now,
      updated_at: now,
    };
    if (input.checkoutStarted) row.checkout_started_at = now;
    if (input.contactAllowed !== undefined) {
      row.contact_allowed = input.contactAllowed;
      row.customer_name = input.contactAllowed ? input.customer?.name ?? "" : "";
      row.customer_phone = input.contactAllowed ? input.customer?.phone ?? "" : "";
      row.customer_email = input.contactAllowed ? input.customer?.email ?? "" : "";
    }

    const { error } = await supabase.from("storefront_cart_sessions").upsert(row, { onConflict: "tenant_id,session_id" });
    if (error) throw new StorefrontRequestError("Não foi possível atualizar o carrinho.", 503);
    return Response.json({ tracked: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return storefrontErrorResponse(error);
  }
}
