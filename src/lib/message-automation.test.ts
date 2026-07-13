import { describe, expect, it } from "vitest";
import { seedData } from "@/data/seed";
import { createMessageLogs, renderMessageTemplate } from "./message-automation";

describe("automacoes de mensagem", () => {
  it("substitui os campos do pedido na mensagem", () => {
    const order = seedData.orders[0];
    expect(renderMessageTemplate("Olá, {{cliente}}. Pedido {{pedido}}: {{status}} — {{total}}.", order)).toContain(order.code);
    expect(renderMessageTemplate("{{cliente}}", order)).toBe(order.customer.name);
  });

  it("gera somente mensagens ativas do status atual", () => {
    const order = { ...seedData.orders[0], status: "Enviado" as const };
    const logs = createMessageLogs(order, seedData.messageAutomations);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ channel: "whatsapp", orderCode: order.code, status: "simulated" });
  });
});
