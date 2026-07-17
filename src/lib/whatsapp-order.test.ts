import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { renderWhatsappOrderMessage } from "./whatsapp-order";

describe("pedido direcionado ao WhatsApp", () => {
  it("substitui os dados do pedido com formatação clara", () => {
    const message = renderWhatsappOrderMessage(seedData.orders[0], seedData.settings);
    expect(message).toContain(seedData.settings.storeName);
    expect(message).toContain(seedData.orders[0].customer.name);
    expect(message).toContain(seedData.orders[0].items[0].name);
    expect(message).toContain(`📦 *Pedido:* ${seedData.orders[0].code}`);
    expect(message).toContain("💳 *Forma de pagamento:* Pix");
    expect(message).toContain(`🎟️ *Cupom utilizado:* ${seedData.orders[0].couponCode}`);
    expect(message).toContain("\n\n*Produtos:*\n• 1x");
    expect(message).not.toContain("\\n");
    expect(message).not.toContain("{{pedido}}");
  });

  it("informa quando nenhum cupom foi utilizado e normaliza quebras escapadas", () => {
    const order = { ...seedData.orders[1], payment: "Cartao" as const, couponCode: "" };
    const settings = { ...seedData.settings, whatsappMessage: "Pedido {{pedido}}\\nPagamento: {{pagamento}}\\nCupom: {{cupom}}" };
    const message = renderWhatsappOrderMessage(order, settings);
    expect(message).toBe(`Pedido ${order.code}\nPagamento: Cartão\nCupom: Nenhum\n\n✅ *Termos e condições aceitos no checkout (versão 2026-07-17).*`);
  });

  it("atualiza automaticamente o modelo antigo salvo no banco", () => {
    const legacySettings = {
      ...seedData.settings,
      whatsappMessage: "Olá! Quero finalizar o pedido {{pedido}} da {{loja}}.\\n\\n{{itens}}\\n\\nTotal: {{total}}\\nCliente: {{cliente}}",
    };
    const message = renderWhatsappOrderMessage(seedData.orders[0], legacySettings);
    expect(message).toContain("🛒 *Novo pedido – Junior Imports*");
    expect(message).toContain("💳 *Forma de pagamento:* Pix");
    expect(message).toContain(`🎟️ *Cupom utilizado:* ${seedData.orders[0].couponCode}`);
    expect(message).not.toContain("\\n");
  });
});
