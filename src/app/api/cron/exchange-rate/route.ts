import { NextResponse } from "next/server";
import { fetchLatestUsdBrlQuote } from "@/lib/exchange-rate";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const client = createAdminClient();
  if (!client) return NextResponse.json({ error: "Supabase indisponível." }, { status: 503 });

  try {
    const quote = await fetchLatestUsdBrlQuote();
    const { data, error } = await client.rpc("refresh_usd_linked_product_prices", {
      p_rate: quote.rate,
      p_rate_date: quote.rateDate,
      p_source: quote.source,
    });
    if (error) throw error;
    return NextResponse.json({ ok: true, quote, result: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (caught) {
    return NextResponse.json({
      ok: false,
      error: caught instanceof Error ? caught.message : "Falha ao atualizar os preços pelo dólar.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
