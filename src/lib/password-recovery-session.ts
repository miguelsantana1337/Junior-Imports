import "server-only";

import { createPasswordRecoveryProof, verifyPasswordRecoveryProof } from "@/lib/password-recovery-proof";

export const passwordRecoveryCookie = "ji-password-recovery";
export const passwordRecoveryLifetimeSeconds = 15 * 60;

function recoverySecret() {
  const secret = process.env.STOREFRONT_SECURITY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Segredo de recuperação de senha não configurado.");
  return secret;
}

export function issuePasswordRecoveryProof(userId: string) {
  return createPasswordRecoveryProof(userId, recoverySecret(), Date.now(), passwordRecoveryLifetimeSeconds);
}

export function hasValidPasswordRecoveryProof(proof: string | undefined, userId: string) {
  if (!proof) return false;
  return verifyPasswordRecoveryProof(proof, userId, recoverySecret());
}

export const passwordRecoveryCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/admin",
  maxAge: passwordRecoveryLifetimeSeconds,
};
