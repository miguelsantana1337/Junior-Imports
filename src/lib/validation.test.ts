import { describe, expect, it } from "vitest";
import { checkoutSchema, productSchema } from "./validation";

describe("validacao do checkout", () => {
  const validCheckout = {
    name: "Cliente Demonstracao",
    phone: "(31) 99999-9999",
    email: "cliente@exemplo.com",
    zip: "35160-000",
    city: "Ipatinga",
    state: "MG",
    address: "Rua Exemplo",
    number: "100",
    complement: "",
    payment: "Pix",
    consent: true,
  };

  it("aceita dados completos", () => {
    expect(checkoutSchema.safeParse(validCheckout).success).toBe(true);
  });

  it("exige consentimento e dados de contato validos", () => {
    const result = checkoutSchema.safeParse({
      ...validCheckout,
      phone: "123",
      email: "invalido",
      consent: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toBeDefined();
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
      expect(result.error.flatten().fieldErrors.consent).toBeDefined();
    }
  });
});

describe("validacao de produto", () => {
  it("converte valores de formulario e rejeita URL invalida", () => {
    const result = productSchema.safeParse({
      name: "Produto teste",
      sku: "JI-TESTE",
      categoryId: "cat-1",
      brand: "Marca",
      price: "99.90",
      compareAt: "119.90",
      stock: "5",
      badge: "Novo",
      accent: "#1677ff",
      description: "Descricao suficientemente completa.",
      rating: "4.8",
      reviews: "10",
      imageUrl: "endereco-invalido",
      featured: true,
      active: true,
    });
    expect(result.success).toBe(false);
  });
});
