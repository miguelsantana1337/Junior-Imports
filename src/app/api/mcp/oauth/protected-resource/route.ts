import { NextResponse } from "next/server";
import { mcpScopes, mcpUrls } from "@/lib/mcp/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const urls = mcpUrls();
  return NextResponse.json({
    resource: urls.resource,
    authorization_servers: [urls.origin],
    scopes_supported: mcpScopes,
    resource_documentation: urls.documentation,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
