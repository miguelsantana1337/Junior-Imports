import { describe, expect, it } from "vitest";
import { asaasPaymentState, validAsaasWebhookToken } from "./asaas-webhook";

describe("confirmação Asaas", () => {
  it("recusa tokens ausentes, curtos ou diferentes", () => {
    const token = "test-only-webhook-secret-with-32-characters";
    expect(validAsaasWebhookToken(null, token)).toBe(false);
    expect(validAsaasWebhookToken("short", "short")).toBe(false);
    expect(validAsaasWebhookToken(`${token}x`, token)).toBe(false);
    expect(validAsaasWebhookToken(token, token)).toBe(true);
  });
  it("não libera pedidos pela criação da cobrança ou por status desconhecido", () => {
    expect(asaasPaymentState("PENDING")).toBe("pending");
    expect(asaasPaymentState("AWAITING_RISK_ANALYSIS")).toBe("review");
    expect(asaasPaymentState("CHARGEBACK_REQUESTED")).toBe("review");
    expect(asaasPaymentState("RECEIVED")).toBe("paid");
    expect(asaasPaymentState("CONFIRMED")).toBe("paid");
    expect(asaasPaymentState("REFUNDED")).toBe("refunded");
  });
});
