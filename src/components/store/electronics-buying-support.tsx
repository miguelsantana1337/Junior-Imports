"use client";

import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { formatMoney, whatsappUrl } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function ElectronicsBuyingSupport() {
  const { data } = useStore();
  const href = (path: string) => withStorefrontPath(data.tenant.storefrontPath, path);
  const contact = whatsappUrl(data.settings.whatsapp, "Olá! Tenho uma dúvida sobre a compra de um eletrônico.");
  return (
    <div className="electronics-buying-support container">
      <section id="entrega" aria-labelledby="electronics-delivery-title">
        <header><span className="electronics-kicker">ENTREGA E RETIRADA</span><h2 id="electronics-delivery-title">Frete e prazo claros antes do pagamento.</h2><p>Confira a disponibilidade na página do modelo. Para produtos sob encomenda, confirme cor, condição e prazo com a equipe antes de pagar.</p></header>
        <div className="electronics-delivery-rates">
          {data.settings.shippingCityRates.map((rate) => <article key={`${rate.city}-${rate.state}`}><h3>{rate.city} · {rate.state}</h3><strong>{formatMoney(rate.amount)}</strong><p>Tarifa de entrega cadastrada</p></article>)}
          {data.settings.quoteShippingOutsideCities && <article><h3>Demais cidades</h3><strong>Sob cotação</strong><p>Informe o CEP. A equipe apresenta o frete antes do pagamento.</p></article>}
          {data.settings.localPickupEnabled && <article><h3>Retirada no local</h3><strong>Agendada</strong><p>{data.settings.localPickupInstructions}</p></article>}
        </div>
        <Link href={href("/politicas/entrega")}>Ver política de entrega e retirada →</Link>
      </section>
      <section id="duvidas" aria-labelledby="electronics-faq-title">
        <header><span className="electronics-kicker">PERGUNTAS FREQUENTES</span><h2 id="electronics-faq-title">Informação antes da compra.</h2><p>Comprar um eletrônico de alto valor exige clareza. Aqui você encontra as condições que já estão definidas e sabe o que confirmar com a equipe.</p></header>
        <div className="electronics-faq-list">
          <details open><summary>Como faço a compra?</summary><p>Escolha o modelo e a capacidade, adicione ao carrinho e preencha os dados no checkout. O pedido é registrado no site e a conversa no WhatsApp abre com o resumo para você revisar e enviar. A equipe confirma as condições e orienta o pagamento.</p></details>
          <details><summary>Os produtos são de pronta entrega?</summary><p>Consulte a indicação na página do produto. Os itens marcados como sob encomenda dependem de confirmação de disponibilidade e prazo pelo atendimento antes do pagamento.</p></details>
          <details><summary>Como escolho cor, capacidade e condição?</summary><p>Selecione a capacidade entre as opções do modelo no catálogo. Informe a preferência de cor no atendimento e confirme a condição do aparelho e o que acompanha o produto antes de concluir a compra.</p></details>
          <details><summary>Quais são as formas de pagamento?</summary><p>No checkout você indica Pix, cartão ou dinheiro como preferência. As condições exibidas são as configuradas pela loja; a equipe apresenta as instruções para o seu pedido no WhatsApp. O site não coleta dados do cartão.</p></details>
          <details><summary>O preço inclui o frete?</summary><p>O preço do catálogo corresponde ao produto. A entrega é calculada para as cidades cadastradas ou cotada pelo CEP. Quando a cotação estiver pendente, o resumo informa o total parcial sem frete.</p></details>
          <details><summary>Como acompanho meu pedido?</summary><p>Guarde o número gerado ao finalizar e use o WhatsApp oficial para solicitar a confirmação, a previsão de envio e as atualizações da entrega.</p></details>
          <details><summary>Como funcionam garantia, troca e devolução?</summary><p>As garantias legais permanecem asseguradas. Nas compras à distância, o direito de arrependimento pode ser exercido em até 7 dias corridos do recebimento. Fotos e vídeos ajudam a analisar avarias, mas sua ausência não elimina direitos legais. Consulte a <Link href={href("/politicas/trocas-e-devolucoes")}>política de trocas e devoluções</Link>.</p></details>
          <details><summary>O produto tem nota fiscal e garantia do fabricante?</summary><p>Confirme com a equipe a documentação e a cobertura disponíveis para o modelo e a condição escolhidos antes de pagar. Eventual garantia do fabricante segue seus próprios critérios e não substitui os direitos legais.</p></details>
        </div>
        <a className="button button-primary" href={contact} target="_blank" rel="noreferrer">Tirar uma dúvida no WhatsApp</a>
      </section>
    </div>
  );
}
