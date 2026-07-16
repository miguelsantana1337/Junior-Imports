import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { friendlyOrderError, requestHash } from "@/lib/storefront-security";
import { manualOrderSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const actor = await requireAdmin("orders");
  try {
    guardAdminMutation(request, actor.id, 15);
  } catch (error) {
    if (error instanceof AdminRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }

  const parsed = manualOrderSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise o pedido." }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });
  const input = parsed.data;
  const customer = {
    name: input.name,
    phone: input.phone,
    email: input.email,
    zip: input.zip,
    city: input.city,
    state: input.state,
    address: input.address,
    number: input.number,
    complement: input.complement,
  };
  const idempotencyKey = randomUUID();
  const hash = requestHash({
    tenantId: actor.tenantId,
    customer,
    items: input.items,
    payment: input.payment,
    couponCode: input.couponCode,
    actorId: actor.id,
  });
  const { data, error } = await supabase.rpc("create_tenant_order_secure", {
    p_tenant_id: actor.tenantId,
    p_customer: customer,
    p_items: input.items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
    p_payment: input.payment,
    p_coupon_code: input.couponCode,
    p_idempotency_key: idempotencyKey,
    p_request_hash: hash,
    p_fingerprint_hash: requestHash({ actorId: actor.id }),
    p_source: "admin",
    p_reservation_minutes: 120,
  });
  if (error || !data) {
    return NextResponse.json({ error: friendlyOrderError(error?.message || "") }, { status: 400 });
  }

  const order = data as { id?: string };
  if (order.id && input.internalNotes) {
    await supabase
      .from("orders")
      .update({ internal_notes: input.internalNotes })
      .eq("tenant_id", actor.tenantId)
      .eq("id", order.id);
  }
  if (order.id) {
    await supabase.from("audit_logs").insert({
      tenant_id: actor.tenantId,
      actor_id: actor.id,
      actor_email: actor.email,
      action: "insert",
      entity_type: "orders",
      entity_id: order.id,
      entity_label: "Pedido manual",
      before_data: null,
      after_data: {
        source: "admin",
        item_count: input.items.length,
        payment: input.payment,
        has_coupon: Boolean(input.couponCode),
      },
    });
  }
  return NextResponse.json({ order: data }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
