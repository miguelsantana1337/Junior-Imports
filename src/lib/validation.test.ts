import { describe, expect, it } from "vitest";
import { bannerSchema, checkoutSchema, messageAutomationSchema, pageBlockSchema, productSchema, storePageSchema } from "./validation";

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

describe("validacao do construtor da loja", () => {
  it("aceita uma pagina e um container de texto validos", () => {
    expect(storePageSchema.safeParse({ name: "Sobre", slug: "sobre", title: "Sobre nós", description: "", active: true, showInNavigation: true, isHome: false }).success).toBe(true);
    expect(pageBlockSchema.safeParse({ pageId: "page-about", kind: "text", name: "Introdução", eyebrow: "SOBRE", title: "Nossa história", body: "Conteúdo da página", buttonText: "", buttonLink: "", imageUrl: "", backgroundColor: "#07090d", textColor: "#ffffff", containerWidth: "normal", padding: "medium", columns: 1, active: true }).success).toBe(true);
  });

  it("exige imagem quando o banner não possui conteúdo", () => {
    const result = bannerSchema.safeParse({ kicker: "", title: "", highlight: "", subtitle: "", buttonText: "", buttonLink: "", startColor: "#07101f", endColor: "#1677ff", imageUrl: "", imageOnly: true, active: true });
    expect(result.success).toBe(false);
  });

  it("valida uma automacao por status", () => {
    expect(messageAutomationSchema.safeParse({ name: "Pedido enviado", triggerStatus: "Enviado", channel: "whatsapp", subject: "", message: "Olá, {{cliente}}! Seu pedido {{pedido}} foi enviado.", active: true }).success).toBe(true);
  });
});
