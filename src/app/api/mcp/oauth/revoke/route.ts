import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashSecret } from "@/lib/mcp/crypto";

export async function POST(request: Request) {
  const form = new URLSearchParams(await request.text());
  const token = form.get("token") ?? "";
  const admin = createAdminClient();
  if (admin && token) {
    const hash = hashSecret(token);
    const revokedAt = new Date().toISOString();
    await admin.from("mcp_oauth_tokens").update({ revoked_at: revokedAt }).or(`access_token_hash.eq.${hash},refresh_token_hash.eq.${hash}`).is("revoked_at", null);
  }
  return new NextResponse(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
