import "server-only";

export type AsaasEnvironment = "sandbox" | "production";
export type AsaasPayment = {
  id: string;
  customer: string;
  billingType: "PIX" | "CREDIT_CARD";
  value: number;
  status: string;
  externalReference: string;
};

export class AsaasRequestError extends Error {
  constructor(public readonly status: number, public readonly uncertain: boolean) {
    super(uncertain ? "Resposta do pagamento inconclusiva. Consulte a cobrança antes de tentar novamente." : "Não foi possível concluir a solicitação de pagamento.");
  }
}

export function asaasConfiguration() {
  const environment = process.env.ASAAS_ENVIRONMENT;
  const apiKey = process.env.ASAAS_API_KEY?.trim();
  if (!apiKey || (environment !== "sandbox" && environment !== "production")) return null;
  if (environment === "production" && process.env.ASAAS_PRODUCTION_ENABLED !== "true") return null;
  return {
    environment: environment as AsaasEnvironment,
    apiKey,
    baseUrl: environment === "production" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3",
  };
}

// This adapter is deliberately server-only. Callers must use persisted,
// server-calculated totals and serialize payment attempts before invoking it.
// POST is never automatically retried: Asaas charges are not idempotent.
export async function asaasRequest<T>(path: string, options: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const config = asaasConfiguration();
  if (!config) throw new AsaasRequestError(503, false);
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) throw new AsaasRequestError(400, false);
  const method = options.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${path}`, {
      method,
      headers: { access_token: config.apiKey, "Content-Type": "application/json", "User-Agent": "JuniorImports/1.0" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(65000),
      cache: "no-store",
      redirect: "error",
    });
  } catch {
    throw new AsaasRequestError(502, method === "POST");
  }
  // Never log provider response bodies: they can contain customer/card data.
  if (!response.ok) throw new AsaasRequestError(response.status, method === "POST" && response.status >= 500);
  try { return await response.json() as T; }
  catch { throw new AsaasRequestError(502, method === "POST"); }
}

export function createAsaasCustomer(customer: { name: string; cpfCnpj: string; email: string; mobilePhone: string; externalReference: string }) {
  return asaasRequest<{ id: string }>("/customers", { method: "POST", body: { ...customer, notificationDisabled: true } });
}

export function createAsaasPayment(payment: { customer: string; billingType: "PIX" | "CREDIT_CARD"; value: number; dueDate: string; externalReference: string; description: string }) {
  if (!Number.isFinite(payment.value) || payment.value <= 0) throw new AsaasRequestError(400, false);
  return asaasRequest<AsaasPayment>("/payments", { method: "POST", body: payment });
}

export function getAsaasPayment(paymentId: string) {
  return asaasRequest<AsaasPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export function getAsaasPix(paymentId: string) {
  return asaasRequest<{ encodedImage: string; payload: string; expirationDate: string }>(`/payments/${encodeURIComponent(paymentId)}/pixQrCode`);
}
