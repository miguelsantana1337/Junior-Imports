export const CHECKOUT_TERMS_VERSION = "2026-07-17";

export const checkoutTerms = {
  title: "RESUMO: GARANTIA E TERMOS",
  videoRequirement:
    "É obrigatório gravar um vídeo sem cortes abrindo a encomenda, mostrando a caixa lacrada e os produtos.",
  noVideoWarning: "Sem o vídeo, não há garantia, troca ou reenvio.",
  agreement:
    "Ao comprar, o cliente declara estar ciente e de acordo com estas condições.",
  sellerResponsibility:
    "Nossa responsabilidade é apenas pela venda e envio do produto.",
  exclusions: [
    "Extravios ou perdas",
    "Apreensões",
    "Atrasos",
    "Danos no transporte",
  ],
  declaration: "Declaro que li e concordo com os termos acima.",
} as const;

export const checkoutTermsConfirmation =
  `Termos e condições aceitos no checkout (versão ${CHECKOUT_TERMS_VERSION}).`;
