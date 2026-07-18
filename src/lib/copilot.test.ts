import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import { buildCopilotAnswer } from "./copilot";

describe("Copiloto Junior read-only", () => {
  it("blocks mutation requests", () => {
    const answer = buildCopilotAnswer("Exclua os produtos sem estoque", cloneSeedData(), "/admin/products");
    expect(answer.intent).toBe("blocked_mutation");
    expect(answer.message).toContain("não executo alterações");
  });

  it("returns low-stock cards with deep links", () => {
    const data = cloneSeedData();
    data.products[0].stock = 0;
    const answer = buildCopilotAnswer("Quais produtos estão com estoque baixo?", data, "/admin/inventory");
    expect(answer.intent).toBe("low_stock");
    expect(answer.cards.some((card) => card.href.startsWith("/admin/products/"))).toBe(true);
  });
});
