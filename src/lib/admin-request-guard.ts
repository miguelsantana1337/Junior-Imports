const attempts = new Map<string, number[]>();

export class AdminRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function guardAdminMutation(request: Request, actorId: string, limit = 30, windowMs = 60_000) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== url.origin) || fetchSite === "cross-site") {
    throw new AdminRequestError("Origem da solicitação não permitida.", 403);
  }

  const now = Date.now();
  const key = `${actorId}:${request.method}:${url.pathname}`;
  const recent = (attempts.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  if (recent.length >= limit) {
    throw new AdminRequestError("Muitas tentativas em pouco tempo. Aguarde um minuto.", 429);
  }
  recent.push(now);
  attempts.set(key, recent);
}
