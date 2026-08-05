import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminRequestError, guardAdminMutation } from "@/lib/admin-request-guard";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TrackedCart, TrackedCartItem } from "@/types/abandoned-cart";

type Row = Record<string, unknown>;

function mapCart(row: Row): TrackedCart {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items: TrackedCartItem[] = rawItems.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const value = item as Row;
    return [{
      productId: String(value.product_id ?? ""),
      name: String(value.name ?? "Produto"),
      quantity: Number(value.quantity) || 0,
      unitPrice: Number(value.unit_price) || 0,
    }];
  });
  return {
    id: String(row.id ?? ""),
    sessionId: String(row.session_id ?? ""),
    status: String(row.status ?? "active") as TrackedCart["status"],
    customerName: String(row.customer_name ?? ""),
    customerPhone: String(row.customer_phone ?? ""),
    customerEmail: String(row.customer_email ?? ""),
    contactAllowed: Boolean(row.contact_allowed),
    items,
    itemCount: Number(row.item_count) || 0,
    subtotal: Number(row.subtotal) || 0,
    checkoutStartedAt: String(row.checkout_started_at ?? ""),
    lastActivityAt: String(row.last_activity_at ?? ""),
    recoveredAt: String(row.recovered_at ?? ""),
    recoveredOrderId: String(row.recovered_order_id ?? ""),
    createdAt: String(row.created_at ?? ""),
    updatedAt: String(row.updated_at ?? ""),
  };
}

export async function GET() {
  const actor = await requireAdmin("orders");
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ carts: [] }, { headers: { "Cache-Control": "no-store" } });

  const { data, error } = await supabase.from("storefront_cart_sessions")
    .select("*")
    .eq("tenant_id", actor.tenantId)
    .order("last_activity_at", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: "Não foi possível carregar os carrinhos." }, { status: 503 });
  return NextResponse.json({ carts: (data ?? []).map((row) => mapCart(row as Row)) }, { headers: { "Cache-Control": "no-store" } });
}

const actionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["dismiss", "restore"]),
});

export async function PATCH(request: Request) {
  const actor = await requireAdmin("orders");
  try {
    guardAdminMutation(request, actor.id, 30);
  } catch (error) {
    if (error instanceof AdminRequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  const { error } = await supabase.from("storefront_cart_sessions")
    .update({ status: parsed.data.action === "dismiss" ? "dismissed" : "active", updated_at: new Date().toISOString() })
    .eq("tenant_id", actor.tenantId)
    .eq("id", parsed.data.id)
    .neq("status", "recovered");
  if (error) return NextResponse.json({ error: "Não foi possível atualizar o carrinho." }, { status: 503 });
  return NextResponse.json({ ok: true });
}
