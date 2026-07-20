export type PostalCodeAddress = {
  address: string;
  city: string;
  state: string;
  district: string;
};

type ViaCepPayload = {
  erro?: boolean | string;
  logradouro?: string;
  localidade?: string;
  uf?: string;
  bairro?: string;
};

export function normalizePostalCode(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function parseViaCepAddress(payload: unknown): PostalCodeAddress | null {
  if (!payload || typeof payload !== "object") return null;
  const data = payload as ViaCepPayload;
  if (data.erro === true || data.erro === "true") return null;
  const city = typeof data.localidade === "string" ? data.localidade.trim() : "";
  const state = typeof data.uf === "string" ? data.uf.trim().toUpperCase() : "";
  if (!city || !/^[A-Z]{2}$/.test(state)) return null;
  return {
    address: typeof data.logradouro === "string" ? data.logradouro.trim() : "",
    city,
    state,
    district: typeof data.bairro === "string" ? data.bairro.trim() : "",
  };
}
