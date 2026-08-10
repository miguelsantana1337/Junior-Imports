import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function randomOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}
export function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function pkceChallenge(verifier: string) {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function hashPayload(value: unknown) {
  return hashSecret(JSON.stringify(stableValue(value)));
}
