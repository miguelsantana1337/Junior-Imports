import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { checkoutWhatsappUrl, renderWhatsappOrderMessage } from "./whatsapp-order";

describe("pedido direcionado ao WhatsApp", () => {
  it("substitui os dados do pedido com formatação clara", () => {
    const message = renderWhatsappOrderMessage(seedData.orders[0], seedData.settings);
    expect(message).toContain(seedData.settings.storeName);
    expect(message).toContain(seedData.orders[0].customer.name);
    expect(message).toContain(seedData.orders[0].items[0].name);
    expect(message).toContain(`*Pedido:* ${seedData.orders[0].code}`);
    expect(message).toContain("*Forma de pagamento:* Pix");
    expect(message).toContain(`*Cupom utilizado:* ${seedData.orders[0].couponCode}`);
    expect(message).toContain("*Desconto obtido:* R$ 64,99 (10%)");
    expect(message.indexOf("*Total do pedido:*")).toBeLessThan(message.indexOf("*Desconto obtido:*"));
    expect(message.indexOf("*Desconto obtido:*")).toBeLessThan(message.indexOf("*Forma de pagamento:*"));
    expect(message).toContain("*Cashback previsto:*");
    expect(message).toContain("50,00");
    expect(message).toContain("\n\n*Produtos:*\n- 1x");
    expect(message).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(message).not.toContain("\\n");
    expect(message).not.toContain("{{pedido}}");
    expect(message).not.toMatch(/termos e condições aceitos no checkout/i);
  });

  it("informa quando nenhum cupom foi utilizado e normaliza quebras escapadas", () => {
    const order = { ...seedData.orders[1], discount: 0, payment: "Cartao" as const, couponCode: "" };
    const settings = { ...seedData.settings, whatsappMessage: "Pedido {{pedido}}\\nPagamento: {{pagamento}}\\nCupom: {{cupom}}" };
    const message = renderWhatsappOrderMessage(order, settings);
    expect(message).toContain(`Pedido ${order.code}\nPagamento: Cartão\nCupom: Nenhum`);
    expect(message).toContain("*Frete:*");
  });

  it("atualiza automaticamente o modelo antigo salvo no banco", () => {
    const legacySettings = {
      ...seedData.settings,
      whatsappMessage: "Olá! Quero finalizar o pedido {{pedido}} da {{loja}}.\\n\\n{{itens}}\\n\\nTotal: {{total}}\\nCliente: {{cliente}}",
    };
    const message = renderWhatsappOrderMessage(seedData.orders[0], legacySettings);
    expect(message).toContain("*Novo pedido - Junior Imports*");
    expect(message).toContain("*Forma de pagamento:* Pix");
    expect(message).toContain(`*Cupom utilizado:* ${seedData.orders[0].couponCode}`);
    expect(message).not.toContain("\\n");
  });

  it("usa exatamente o WhatsApp salvo nas configurações como destino", () => {
    const settings = { ...seedData.settings, whatsapp: "55 (31) 98888-7777" };
    const url = new URL(checkoutWhatsappUrl(seedData.orders[0], settings));
    expect(url.origin + url.pathname).toBe("https://wa.me/5531988887777");
    expect(url.searchParams.get("text")).toContain(seedData.orders[0].code);
  });

  it("inclui o código do Brasil quando o painel salva apenas DDD e número", () => {
    const settings = { ...seedData.settings, whatsapp: "(31) 98904-7131" };
    const url = new URL(checkoutWhatsappUrl(seedData.orders[0], settings));
    expect(url.origin + url.pathname).toBe("https://wa.me/5531989047131");
  });

  it("informa dinheiro como forma de pagamento", () => {
    const order = { ...seedData.orders[0], payment: "Dinheiro" as const };
    expect(renderWhatsappOrderMessage(order, seedData.settings)).toContain("*Forma de pagamento:* Dinheiro");
  });

  it("permite posicionar valor e percentual do desconto em um modelo personalizado", () => {
    const order = { ...seedData.orders[0], subtotal: 3950, discount: 395, total: 3555, cashbackTotal: 0 };
    const settings = {
      ...seedData.settings,
      whatsappMessage: "Pedido {{pedido}}\nDesconto: {{desconto}} ({{percentual_desconto}})\nTotal: {{total}}",
    };
    const message = renderWhatsappOrderMessage(order, settings);

    expect(message).toContain("Desconto: R$ 395,00 (10%)");
    expect(message.match(/R\$ 395,00/g)).toHaveLength(1);
  });

  it("diferencia cotacao de frete gratis para cidades fora da tabela", () => {
    const order = {
      ...seedData.orders[0],
      shipping: 0,
      shippingStatus: "quote" as const,
      total: seedData.orders[0].subtotal - seedData.orders[0].discount,
      customer: { ...seedData.orders[0].customer, city: "Belo Horizonte", state: "MG", zip: "30110-000" },
    };
    const message = renderWhatsappOrderMessage(order, seedData.settings);

    expect(message).toContain("*Total parcial (sem frete):*");
    expect(message).toContain("*Frete:* A cotar pelo CEP (30110-000 · Belo Horizonte/MG)");
    expect(message).not.toContain("*Frete:* Grátis");
  });

  it("identifica retirada no local e inclui as orientacoes configuradas", () => {
    const order = {
      ...seedData.orders[0],
      shipping: 0,
      shippingStatus: "pickup" as const,
      customer: {
        ...seedData.orders[0].customer,
        deliveryMethod: "pickup" as const,
        zip: "",
        city: "",
        state: "",
        address: "",
        number: "",
      },
    };
    const message = renderWhatsappOrderMessage(order, seedData.settings);

    expect(message).toContain("*Frete:* Retirada no local");
    expect(message).toContain(`*Retirada no local:* ${seedData.settings.localPickupInstructions}`);
    expect(message).not.toContain("A cotar pelo CEP");
  });

  it("remove emojis e nunca expõe o SKU interno dos itens", () => {
    const order = {
      ...seedData.orders[0],
      items: seedData.orders[0].items.map((item) => ({ ...item, sku: "JI-INTERNO-001" })),
    };
    const settings = {
      ...seedData.settings,
      whatsappMessage: "🛒 Pedido {{pedido}}\nSKU: {{sku}}\n{{itens}}\n✅ Confirmado",
    };
    const message = renderWhatsappOrderMessage(order, settings);

    expect(message).not.toContain("JI-INTERNO-001");
    expect(message).not.toMatch(/\bSKU\b/i);
    expect(message).not.toMatch(/\p{Extended_Pictographic}/u);
  });

  it("remove avisos antigos de tratamento de dados salvos no modelo", () => {
    const settings = {
      ...seedData.settings,
      whatsappMessage: "Pedido {{pedido}}\nCliente concordou com o tratamento de dados pessoais.\nTotal: {{total}}",
    };
    const message = renderWhatsappOrderMessage(seedData.orders[0], settings);

    expect(message).toContain(`Pedido ${seedData.orders[0].code}`);
    expect(message).toContain("Total:");
    expect(message).not.toMatch(/tratamento de dados|concordou/i);
  });

  it("inclui fidelidade e brinde confirmados pelo servidor", () => {
    const message = renderWhatsappOrderMessage({
      ...seedData.orders[0],
      loyaltyDiscount: 150,
      campaignGift: "Coqueteleira + brindes nos pedidos",
    }, seedData.settings);

    expect(message.replaceAll("\u00a0", " ")).toContain("*Benefício de fidelidade:* -R$ 150,00");
    expect(message).toContain("*Brinde da campanha:* Coqueteleira + brindes nos pedidos");
  });
});
