import { NextResponse } from "next/server";
import { OAuthRequestError, validateOAuthAuthorizeRequest } from "@/lib/mcp/oauth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  try {
    await validateOAuthAuthorizeRequest(url.searchParams);
  } catch (error) {
    const known = error instanceof OAuthRequestError ? error : new OAuthRequestError("Solicitação OAuth inválida.");
    return NextResponse.json({ error: known.code, error_description: known.message }, { status: 400 });
  }
  const destination = new URL("/admin/mcp/authorize", url.origin);
  url.searchParams.forEach((value, key) => destination.searchParams.set(key, value));
  return NextResponse.redirect(destination, 302);
}
