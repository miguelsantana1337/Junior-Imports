import { createHmac, timingSafeEqual } from "node:crypto";

interface PasswordRecoveryPayload {
  sub: string;
  exp: number;
  purpose: "password-recovery";
}

function sign(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createPasswordRecoveryProof(
  userId: string,
  secret: string,
  now = Date.now(),
  lifetimeSeconds = 15 * 60,
) {
  const payload: PasswordRecoveryPayload = {
    sub: userId,
    exp: Math.floor(now / 1000) + lifetimeSeconds,
    purpose: "password-recovery",
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export function verifyPasswordRecoveryProof(
  proof: string,
  userId: string,
  secret: string,
  now = Date.now(),
) {
  const [encodedPayload, receivedSignature, extra] = proof.split(".");
  if (!encodedPayload || !receivedSignature || extra) return false;

  const expectedSignature = sign(encodedPayload, secret);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<PasswordRecoveryPayload>;
    return (
      payload.purpose === "password-recovery"
      && payload.sub === userId
      && typeof payload.exp === "number"
      && payload.exp >= Math.floor(now / 1000)
    );
  } catch {
    return false;
  }
}
