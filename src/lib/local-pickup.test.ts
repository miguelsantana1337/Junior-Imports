import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { checkoutCustomerSchema, checkoutSchema } from "./validation";

const customerBase = {
  name: "Cliente Teste",
  phone: "(31) 99999-9999",
  email: "cliente@example.com",
  complement: "",
};

describe("retirada no local", () => {
  it("permite finalizar sem endereco quando a retirada foi escolhida", () => {
    const result = checkoutSchema.safeParse({
      ...customerBase,
      deliveryMethod: "pickup",
      zip: "",
      city: "",
      state: "",
      address: "",
      number: "",
      payment: "Pix",
      consent: true,
      termsAccepted: true,
      botField: "",
      startedAt: Date.now(),
    });

    expect(result.success).toBe(true);
  });

  it("continua exigindo endereco completo para entrega", () => {
    const result = checkoutCustomerSchema.safeParse({
      ...customerBase,
      deliveryMethod: "delivery",
      zip: "",
      city: "",
      state: "",
      address: "",
      number: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["zip", "city", "state", "address", "number"]),
      );
    }
  });

  it("protege a opcao e o frete zero no banco", () => {
    const migration = readFileSync(
      "supabase/migrations/202607200010_local_pickup.sql",
      "utf8",
    );

    expect(migration).toContain("local_pickup_enabled");
    expect(migration).toContain("'status', 'pickup'");
    expect(migration).toContain("Retirada no local indisponível");
    expect(migration).toContain("'pickup'");
  });
});
