import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  canRemoveMfaFactor,
  mfaFactorName,
  shortMfaFactorId,
  type AdminMfaFactor,
  validateMfaFactorName,
} from "./admin-mfa";
import { adminMfaAuditSchema } from "./validation";

function factor(
  id: string,
  status: AdminMfaFactor["status"] = "verified",
  friendlyName?: string,
): AdminMfaFactor {
  return {
    id,
    status,
    factor_type: "totp",
    friendly_name: friendlyName,
    created_at: "2026-07-17T12:00:00.000Z",
    updated_at: "2026-07-17T12:00:00.000Z",
  };
}

describe("gerenciamento administrativo de MFA", () => {
  it("identifica dispositivos com nomes claros e sem expor o identificador completo", () => {
    expect(mfaFactorName(factor("factor-1", "verified", "Júnior — principal"))).toBe("Júnior — principal");
    expect(mfaFactorName(factor("factor-2"), 1)).toBe("Autenticador 2");
    expect(shortMfaFactorId("12345678-1234-1234-1234-123456789abc")).toBe("•••• 56789abc");
  });

  it("valida nomes únicos antes de cadastrar um novo dispositivo", () => {
    const factors = [factor("factor-1", "verified", "Júnior — principal")];
    expect(validateMfaFactorName("  Celular   reserva  ", factors)).toEqual({
      value: "Celular reserva",
      error: "",
    });
    expect(validateMfaFactorName("Júnior — principal", factors).error).toMatch(/Já existe/);
    expect(validateMfaFactorName("TV", factors).error).toMatch(/pelo menos 3/);
  });

  it("impede remover o último fator confirmado", () => {
    const primary = factor("factor-1");
    const backup = factor("factor-2");
    expect(canRemoveMfaFactor([primary], primary.id)).toBe(false);
    expect(canRemoveMfaFactor([primary, backup], primary.id)).toBe(true);
    expect(canRemoveMfaFactor([primary, factor("pending", "unverified")], primary.id)).toBe(false);
  });

  it("mantém a auditoria minimizada e sem QR Code ou chave secreta", () => {
    expect(adminMfaAuditSchema.safeParse({
      action: "enroll",
      factorId: "34e770dd-9ff9-416c-87fa-43b31d7ef225",
      friendlyName: "Júnior — principal",
    }).success).toBe(true);

    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/security/mfa-audit/route.ts"),
      "utf8",
    );
    const component = readFileSync(
      resolve(process.cwd(), "src/components/admin/security-mfa-admin.tsx"),
      "utf8",
    );
    expect(route).toContain('entity_type: "auth_mfa_factors"');
    expect(route).not.toContain("qrCode");
    expect(route).not.toContain("secret");
    expect(component).toContain("factorId: proofFactor.id");
    expect(component).toContain("dispositivo que permanecerá ativo");
  });
});
