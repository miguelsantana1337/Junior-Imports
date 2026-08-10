import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAllowedMcpRedirectUri } from "@/lib/mcp/config";
import { randomOpaqueToken } from "@/lib/mcp/crypto";

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(120).default("ChatGPT"),
  redirect_uris: z.array(z.string().url()).min(1).max(5),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).max(2).optional(),
  response_types: z.array(z.literal("code")).max(1).optional(),
  token_endpoint_auth_method: z.literal("none").optional(),
});

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.redirect_uris.some((uri) => !isAllowedMcpRedirectUri(uri))) {
    return NextResponse.json({ error: "invalid_redirect_uri", error_description: "URL de retorno não autorizada." }, { status: 400 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "temporarily_unavailable" }, { status: 503 });
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count } = await admin
    .from("mcp_oauth_clients")
    .select("client_id", { head: true, count: "exact" })
    .gte("created_at", since);
  if ((count ?? 0) >= 30) {
    return NextResponse.json({
      error: "temporarily_unavailable",
      error_description: "Muitas tentativas de registro. Tente novamente em alguns minutos.",
    }, { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
  }
  const clientId = randomOpaqueToken("ji_mcp_client");
  const { error } = await admin.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: parsed.data.client_name,
    redirect_uris: parsed.data.redirect_uris,
    grant_types: parsed.data.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: parsed.data.response_types ?? ["code"],
    token_endpoint_auth_method: "none",
  });
  if (error) return NextResponse.json({ error: "server_error" }, { status: 500 });
  return NextResponse.json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: parsed.data.client_name,
    redirect_uris: parsed.data.redirect_uris,
    grant_types: parsed.data.grant_types ?? ["authorization_code", "refresh_token"],
    response_types: parsed.data.response_types ?? ["code"],
    token_endpoint_auth_method: "none",
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
