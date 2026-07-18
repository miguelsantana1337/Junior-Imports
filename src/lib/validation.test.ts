import { describe, expect, it } from "vitest";
import { adminUserCreateSchema, adminUserPasswordResetSchema, bannerSchema, checkoutSchema, messageAutomationSchema, pageBlockSchema, productSchema, savedReportSchema, storePageSchema } from "./validation";

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
    termsAccepted: true,
    botField: "",
    startedAt: Date.now(),
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
      termsAccepted: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.phone).toBeDefined();
      expect(result.error.flatten().fieldErrors.email).toBeDefined();
      expect(result.error.flatten().fieldErrors.consent).toBeDefined();
      expect(result.error.flatten().fieldErrors.termsAccepted).toBeDefined();
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
    expect(messageAutomationSchema.safeParse({ id: "automation-test", name: "Pedido enviado", triggerType: "order_status", triggerValue: "Enviado", triggerStatus: "Enviado", channel: "whatsapp", subject: "", message: "Olá, {{cliente}}! Seu pedido {{pedido}} foi enviado.", conditions: { minOrderTotal: 0, orderSource: "any", customerSegment: "all" }, actions: { sendMessage: true, createTask: false, taskTitle: "", addTag: "" }, status: "active", maxRetries: 3, retryDelayMinutes: 15, lastTestedAt: "", runCount: 0, failureCount: 0, active: true, order: 1 }).success).toBe(true);
  });
});

describe("validacao de usuarios administrativos", () => {
  it("aceita um usuario com cargo e permissoes", () => {
    expect(adminUserCreateSchema.safeParse({ fullName: "Equipe Comercial", email: "equipe@exemplo.com", password: "senha-segura-123", role: "support", permissions: ["dashboard", "orders"], active: true }).success).toBe(true);
  });

  it("rejeita senha curta e usuario sem permissoes", () => {
    expect(adminUserCreateSchema.safeParse({ fullName: "Equipe Comercial", email: "equipe@exemplo.com", password: "123", role: "viewer", permissions: [], active: true }).success).toBe(false);
  });

  it("exige senha forte e confirmação idêntica na redefinição", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(adminUserPasswordResetSchema.safeParse({ id, password: "Senha-Forte-2026!", confirmation: "Senha-Forte-2026!" }).success).toBe(true);
    expect(adminUserPasswordResetSchema.safeParse({ id, password: "Senha-Forte-2026!", confirmation: "outra-senha" }).success).toBe(false);
  });
});

describe("validacao de relatorios", () => {
  it("aceita período consistente e a permissão de relatórios", () => {
    expect(savedReportSchema.safeParse({ id: "report-1", name: "Vendas mensais", type: "sales", dateFrom: "2026-07-01", dateTo: "2026-07-31", comparePrevious: true, filters: {}, shared: true, createdBy: "admin@exemplo.com", createdAt: "2026-07-18T12:00:00Z", updatedAt: "2026-07-18T12:00:00Z" }).success).toBe(true);
    expect(adminUserCreateSchema.safeParse({ fullName: "Equipe Financeira", email: "financeiro@exemplo.com", password: "senha-segura-123", role: "manager", permissions: ["dashboard", "reports"], active: true }).success).toBe(true);
  });

  it("rejeita data final anterior à inicial", () => {
    expect(savedReportSchema.safeParse({ id: "report-1", name: "Vendas mensais", type: "sales", dateFrom: "2026-07-31", dateTo: "2026-07-01", comparePrevious: false, filters: {}, shared: false, createdBy: "", createdAt: "", updatedAt: "" }).success).toBe(false);
  });
});
