import type { Faq, PageBlock } from "@/types/store";

export const defaultPurchaseFaqs: Faq[] = [
  { id: "commerce-faq-how-to-buy", question: "Como faço uma compra?", answer: "Escolha os produtos, adicione ao carrinho e preencha o checkout. Ao finalizar, o pedido será registrado e o WhatsApp abrirá com todos os dados para a equipe continuar o atendimento.", order: 1 },
  { id: "commerce-faq-payment", question: "Como será feito o pagamento?", answer: "No checkout você informa a forma de pagamento preferida. A equipe confirma pelo WhatsApp os dados, o valor final e as instruções para pagamento.", order: 2 },
  { id: "commerce-faq-shipping", question: "Quando meu pedido será enviado?", answer: "O envio é organizado depois da confirmação do pedido e do pagamento. Todas as atualizações são repassadas diretamente pelo atendimento no WhatsApp.", order: 3 },
  { id: "commerce-faq-guarantee", question: "Como funciona a garantia?", answer: "É obrigatório gravar um vídeo sem cortes abrindo a encomenda, começando pela caixa ainda lacrada e mostrando os produtos. Sem esse vídeo, não há garantia, troca ou reenvio.", order: 4 },
  { id: "commerce-faq-support", question: "Posso tirar dúvidas antes de comprar?", answer: "Sim. Use o botão de WhatsApp da loja para falar com a equipe antes de finalizar o pedido.", order: 5 },
];

export const defaultPurchaseFaqBlock: PageBlock = {
  id: "commerce-faq-fallback", pageId: "home", kind: "faq", name: "Como comprar",
  eyebrow: "PERGUNTAS FREQUENTES", title: "Como comprar na Junior Imports.", body: "",
  buttonText: "", buttonLink: "", imageUrl: "", backgroundColor: "", textColor: "",
  containerWidth: "normal", padding: "large", columns: 1, active: true, order: 999,
};

export function resolvePurchaseFaqs(faqs: Faq[]) {
  return faqs.length ? [...faqs].sort((left, right) => left.order - right.order) : defaultPurchaseFaqs;
}

export function ensurePurchaseFaqBlock(blocks: PageBlock[], isHome: boolean) {
  if (!isHome || blocks.some((block) => block.kind === "faq")) return blocks;
  return [...blocks, defaultPurchaseFaqBlock];
}
