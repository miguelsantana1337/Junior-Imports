export type AdminMfaFactor = {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: "verified" | "unverified";
  created_at: string;
  updated_at: string;
  last_challenged_at?: string;
};

export function mfaFactorName(factor: AdminMfaFactor, index = 0) {
  return factor.friendly_name?.trim() || `Autenticador ${index + 1}`;
}

export function validateMfaFactorName(name: string, factors: AdminMfaFactor[] = []) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (normalized.length < 3) return { value: normalized, error: "Informe um nome com pelo menos 3 caracteres." };
  if (normalized.length > 50) return { value: normalized, error: "Use no máximo 50 caracteres para identificar o dispositivo." };
  if (factors.some((factor) => mfaFactorName(factor).toLocaleLowerCase("pt-BR") === normalized.toLocaleLowerCase("pt-BR"))) {
    return { value: normalized, error: "Já existe um autenticador com esse nome. Escolha outro nome." };
  }
  return { value: normalized, error: "" };
}

export function canRemoveMfaFactor(factors: AdminMfaFactor[], factorId: string) {
  const verified = factors.filter(
    (factor) => factor.factor_type === "totp" && factor.status === "verified",
  );
  return verified.length > 1 && verified.some((factor) => factor.id === factorId);
}

export function shortMfaFactorId(id: string) {
  return id.length > 8 ? `•••• ${id.slice(-8)}` : id;
}
