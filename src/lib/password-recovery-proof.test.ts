import { describe, expect, it } from "vitest";
import { createPasswordRecoveryProof, verifyPasswordRecoveryProof } from "./password-recovery-proof";

describe("prova temporária de recuperação de senha", () => {
  const secret = "segredo-de-teste-com-entropia-suficiente";
  const userId = "70663e75-9698-43ce-a0f8-269c52be68ce";
  const now = Date.UTC(2026, 6, 16, 15, 0, 0);

  it("valida usuário, assinatura e prazo", () => {
    const proof = createPasswordRecoveryProof(userId, secret, now, 900);

    expect(verifyPasswordRecoveryProof(proof, userId, secret, now + 899_000)).toBe(true);
    expect(verifyPasswordRecoveryProof(proof, "outro-usuario", secret, now)).toBe(false);
    expect(verifyPasswordRecoveryProof(proof, userId, "segredo-incorreto", now)).toBe(false);
    expect(verifyPasswordRecoveryProof(proof, userId, secret, now + 901_000)).toBe(false);
  });

  it("rejeita conteúdo adulterado", () => {
    const proof = createPasswordRecoveryProof(userId, secret, now);
    expect(verifyPasswordRecoveryProof(`${proof}x`, userId, secret, now)).toBe(false);
    expect(verifyPasswordRecoveryProof("formato-invalido", userId, secret, now)).toBe(false);
  });
});
