import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest, McpAuthError, mcpAuthorizationChallenge } from "@/lib/mcp/auth";
import { createJuniorImportsMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

async function handle(request: Request) {
  try {
    const actor = await authenticateMcpRequest(request);
    const server = createJuniorImportsMcpServer(actor);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const headers = new Headers(response.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => headers.set(key, value));
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch (error) {
    const auth = error instanceof McpAuthError ? error : null;
    const status = auth?.status ?? 500;
    const message = auth?.message ?? "Erro interno do gateway MCP.";
    const headers = new Headers({ ...corsHeaders, "Cache-Control": "no-store", "Content-Type": "application/json" });
    if (status === 401 || status === 403) headers.set("WWW-Authenticate", mcpAuthorizationChallenge(auth?.code, message, auth?.scope));
    return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: status === 401 ? -32001 : -32603, message }, id: null }), { status, headers });
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
