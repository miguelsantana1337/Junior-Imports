import { normalizePostalCode, parseViaCepAddress } from "@/lib/postal-code";

export async function GET(request: Request) {
  const cep = normalizePostalCode(new URL(request.url).searchParams.get("cep") ?? "");
  if (cep.length !== 8) {
    return Response.json({ error: "Informe um CEP válido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      signal: AbortSignal.timeout(5_000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) throw new Error("Postal code provider unavailable");
    const address = parseViaCepAddress(await response.json());
    if (!address) {
      return Response.json({ error: "CEP não encontrado." }, { status: 404, headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(address, { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } });
  } catch {
    return Response.json({ error: "Não foi possível consultar o CEP agora." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
