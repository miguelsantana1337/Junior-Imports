export const CHECKOUT_TERMS_VERSION = "2026-07-17";
export const ELECTRONICS_CHECKOUT_TERMS_VERSION = "electronics-2026-09-04";

export const electronicsCheckoutTerms = {
  title: "TERMOS DA COMPRA DE ELETRÔNICOS",
  items: [
    "Confira modelo, capacidade, condição, preço e disponibilidade antes de confirmar a compra.",
    "Produtos sob encomenda dependem de confirmação do prazo pelo atendimento antes do pagamento.",
    "O frete é calculado ou cotado separadamente; o total deve ser confirmado antes de pagar.",
    "O direito de arrependimento nas compras à distância e as garantias legais permanecem assegurados.",
    "Fotos e vídeos de abertura ajudam na análise de avarias, mas sua ausência não elimina direitos legais.",
  ],
  declaration: "Revisei o pedido e li os termos, a política de entrega e a política de trocas e devoluções.",
} as const;

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
