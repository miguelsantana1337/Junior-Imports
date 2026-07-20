import { describe, expect, it } from "vitest";
import { defaultPurchaseFaqs, ensurePurchaseFaqBlock, resolvePurchaseFaqs } from "./storefront-commerce";
import type { Faq, PageBlock } from "@/types/store";

describe("conteúdo comercial da vitrine", () => {
  it("oferece as perguntas de compra quando a base ainda não possui FAQ", () => {
    expect(resolvePurchaseFaqs([])).toEqual(defaultPurchaseFaqs);
    expect(defaultPurchaseFaqs).toHaveLength(5);
    expect(defaultPurchaseFaqs[0]?.question).toBe("Como faço uma compra?");
  });

  it("preserva e ordena as perguntas configuradas no painel", () => {
    const configured: Faq[] = [
      { id: "second", question: "Segunda", answer: "B", order: 2 },
      { id: "first", question: "Primeira", answer: "A", order: 1 },
    ];
    expect(resolvePurchaseFaqs(configured).map((faq) => faq.id)).toEqual(["first", "second"]);
  });

  it("restaura a aba de FAQ na página inicial sem duplicar um bloco existente", () => {
    const content: PageBlock[] = [];
    const withFaq = ensurePurchaseFaqBlock(content, true);
    expect(withFaq).toHaveLength(1);
    expect(withFaq[0]?.kind).toBe("faq");
    expect(ensurePurchaseFaqBlock(withFaq, true)).toHaveLength(1);
    expect(ensurePurchaseFaqBlock(content, false)).toEqual([]);
  });
});
