"use client";

import { ArrowLeft, Clock3, Mail, MessageCircle, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { formatMoney, formatWhatsappDisplay, whatsappUrl } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export type ElectronicsPolicySlug = "termos-de-compra" | "entrega" | "trocas-e-devolucoes" | "privacidade";

const policyLinks: Array<{ slug: ElectronicsPolicySlug; label: string }> = [
  { slug: "termos-de-compra", label: "Termos de compra" },
  { slug: "entrega", label: "Entrega e retirada" },
  { slug: "trocas-e-devolucoes", label: "Trocas e devoluções" },
  { slug: "privacidade", label: "Privacidade" },
];

export function ElectronicsPolicyPage({ policy }: { policy: ElectronicsPolicySlug }) {
  const { data } = useStore();
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const whatsappHref = whatsappUrl(data.settings.whatsapp, "Olá! Gostaria de falar sobre as condições de compra de eletrônicos.");
  const whatsappLabel = formatWhatsappDisplay(data.settings.whatsapp);

  return (
    <div className="electronics-policy-page">
      <div className="electronics-policy-shell">
        <Link className="electronics-policy-back" href={storeHref("/")}><ArrowLeft aria-hidden="true" /> Voltar para eletrônicos</Link>
        <div className="electronics-policy-layout">
          <aside>
            <span className="electronics-eyebrow">INFORMAÇÕES DA LOJA</span>
            <strong>Compra de eletrônicos</strong>
            <nav aria-label="Políticas de compra">
              {policyLinks.map((item) => (
                <Link
                  className={policy === item.slug ? "active" : ""}
                  href={storeHref(`/politicas/${item.slug}`)}
                  aria-current={policy === item.slug ? "page" : undefined}
                  key={item.slug}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <article className="electronics-policy-content">
            {policy === "termos-de-compra" && <TermsPolicy />}
            {policy === "entrega" && <DeliveryPolicy />}
            {policy === "trocas-e-devolucoes" && <ReturnsPolicy />}
            {policy === "privacidade" && <PrivacyPolicy />}
            <section className="electronics-policy-contact" aria-labelledby="policy-contact-title">
              <div><span className="electronics-eyebrow">ATENDIMENTO</span><h2 id="policy-contact-title">Fale com a {data.settings.storeName}.</h2><p>Para dúvidas, solicitações ou acompanhamento, use um dos canais oficiais abaixo e informe o número do pedido quando já houver um.</p></div>
              <div>
                <a href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle aria-hidden="true" /><span><strong>WhatsApp</strong><small>{whatsappLabel}</small></span></a>
                <a href={`mailto:${data.settings.email}`}><Mail aria-hidden="true" /><span><strong>E-mail</strong><small>{data.settings.email}</small></span></a>
                <span><Clock3 aria-hidden="true" /><span><strong>Horário informado</strong><small>{data.settings.hours}</small></span></span>
              </div>
            </section>
          </article>
        </div>
      </div>
    </div>
  );
}

function PolicyHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header><span className="electronics-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p><small>Última atualização: 4 de setembro de 2026</small></header>;
}

function TermsPolicy() {
  return (
    <>
      <PolicyHeader eyebrow="TERMOS DE COMPRA" title="Como o pedido de eletrônicos é confirmado." description="Estes termos explicam o fluxo da página de eletrônicos, do carrinho à confirmação comercial pelo atendimento." />
      <section><h2>1. Produtos sob encomenda</h2><p>Os eletrônicos desta área são anunciados como produtos sob encomenda. O comprador escolhe o modelo no catálogo e informa sua preferência de cor e condição no atendimento. A equipe confirma o que está efetivamente disponível e o prazo aplicável antes do pagamento.</p></section>
      <section><h2>2. Preço e frete</h2><p>O preço exibido na página corresponde ao produto selecionado. O frete não está incluído nesse valor: ele é calculado para as cidades cadastradas ou cotado pelo CEP. Nenhuma mudança de valor deve ser aplicada sem apresentação prévia e concordância do comprador.</p></section>
      <section><h2>3. Registro e confirmação</h2><p>Ao finalizar o checkout, o pedido é registrado no sistema e o WhatsApp oficial abre com o resumo. O registro organiza a solicitação; a venda é confirmada depois que modelo, cor, condição, disponibilidade, prazo, entrega e forma de pagamento forem aceitos pelas partes.</p></section>
      <section><h2>4. Pagamento</h2><p>O checkout permite indicar Pix, cartão ou dinheiro como preferência. As instruções e condições aplicáveis são apresentadas pelo atendimento somente depois da confirmação dos dados da encomenda.</p></section>
      <section><h2>5. Direitos do consumidor</h2><p>Estes termos não afastam os direitos previstos na legislação brasileira, inclusive o direito de arrependimento nas compras realizadas à distância e as garantias legais quando aplicáveis.</p></section>
    </>
  );
}

function DeliveryPolicy() {
  const { data } = useStore();
  return (
    <>
      <PolicyHeader eyebrow="ENTREGA E RETIRADA" title="Frete informado antes do pagamento." description="A entrega depende do destino e do prazo confirmado para o produto sob encomenda." />
      <section><h2>1. Cidades com valor cadastrado</h2><p>Ao preencher o CEP no checkout, o sistema identifica a cidade e aplica o valor disponível para a região.</p><div className="electronics-policy-rate-list">{data.settings.shippingCityRates.map((rate) => <div key={`${rate.city}-${rate.state}`}><span>{rate.city} · {rate.state}</span><strong>{formatMoney(rate.amount)}</strong></div>)}</div></section>
      {data.settings.quoteShippingOutsideCities && <section><h2>2. Demais cidades</h2><p>Para destinos sem tarifa cadastrada, o frete fica sob cotação. O valor deve ser informado e aceito no WhatsApp antes do pagamento. O pedido não apresenta frete como gratuito enquanto a cotação estiver pendente.</p></section>}
      {data.settings.localPickupEnabled && <section><h2>3. Retirada agendada</h2><p>{data.settings.localPickupInstructions}</p></section>}
      <section><h2>4. Prazo</h2><p>Como os eletrônicos são vendidos sob encomenda, o prazo depende da confirmação de disponibilidade do modelo e do destino. A equipe informa a previsão aplicável antes do pagamento e comunica as atualizações pelo canal de atendimento.</p></section>
      <section><h2>5. Recebimento</h2><p>Confira a embalagem e o produto assim que receber. Se houver sinal de avaria, divergência de modelo ou item faltante, preserve a embalagem e entre em contato pelos canais oficiais. Registrar a abertura em vídeo pode ajudar na análise, sem substituir os direitos legais do consumidor.</p></section>
    </>
  );
}

function ReturnsPolicy() {
  return (
    <>
      <PolicyHeader eyebrow="TROCAS E DEVOLUÇÕES" title="Procedimento claro para compras online." description="Esta política se aplica aos eletrônicos comprados à distância na Junior Imports e complementa os direitos previstos em lei." />
      <section><h2>1. Direito de arrependimento</h2><p>Nas compras realizadas à distância, o consumidor pode solicitar o cancelamento em até 7 dias corridos contados do recebimento do produto, conforme o artigo 49 do Código de Defesa do Consumidor.</p></section>
      <section><h2>2. Como solicitar</h2><p>Entre em contato pelo WhatsApp ou e-mail oficial, informe o número do pedido e descreva a solicitação. A equipe orientará a forma de devolução adequada. Para facilitar a conferência, mantenha o produto acompanhado dos itens, acessórios e materiais recebidos.</p></section>
      <section><h2>3. Custos e reembolso</h2><p>No exercício regular do direito de arrependimento dentro do prazo legal, não será cobrada taxa de devolução do consumidor. Depois do recebimento e da conferência, os valores pagos serão restituídos pelo mesmo meio utilizado ou por alternativa expressamente acordada, observados os prazos aplicáveis.</p></section>
      <section><h2>4. Avaria, divergência ou defeito</h2><p>Comunique o problema assim que for identificado e envie as informações necessárias para análise. Fotos e vídeo de abertura podem acelerar a apuração, mas a ausência desse registro não elimina direitos previstos na legislação. As garantias legais e, quando existentes, as garantias do fabricante seguem seus respectivos critérios.</p></section>
      <section><h2>5. Cancelamento antes do envio</h2><p>Se o produto ainda não tiver sido enviado, solicite o cancelamento imediatamente pelos canais oficiais. A equipe verificará o estágio da encomenda e informará o procedimento aplicável.</p></section>
    </>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <PolicyHeader eyebrow="PRIVACIDADE" title="Como os dados do pedido são usados." description="A loja coleta apenas as informações necessárias para registrar, proteger e acompanhar o pedido e o atendimento." />
      <section><h2>1. Dados informados pelo comprador</h2><p>O checkout pode coletar nome, WhatsApp, e-mail, CEP, cidade, estado, endereço, preferência de entrega, forma de pagamento indicada, itens do carrinho e aceite dos termos.</p></section>
      <section><h2>2. Dados técnicos</h2><p>Para segurança e continuidade do carrinho, o sistema pode registrar identificadores de sessão, origem da visita, código de indicação, eventos do funil de compra e informações técnicas necessárias para prevenção de abuso. O navegador também armazena dados funcionais do carrinho e dos favoritos.</p></section>
      <section><h2>3. Finalidades</h2><p>Esses dados são usados para calcular e registrar o pedido, conferir estoque e frete, prevenir fraude, prestar atendimento, abrir a conversa solicitada no WhatsApp e manter o histórico operacional necessário.</p></section>
      <section><h2>4. Compartilhamento necessário</h2><p>As informações podem ser processadas por serviços de infraestrutura, banco de dados e segurança indispensáveis ao funcionamento da loja. Quando o comprador conclui o fluxo, o WhatsApp recebe o resumo necessário para continuar o atendimento. Os dados não devem ser vendidos.</p></section>
      <section><h2>5. Conservação e direitos</h2><p>Os registros são mantidos pelo período necessário ao atendimento, à segurança da operação e às obrigações legais. O titular pode usar os canais oficiais para solicitar acesso, correção ou outras providências previstas na legislação aplicável.</p></section>
      <aside className="electronics-policy-note"><ShieldCheck aria-hidden="true" /><p>Nenhuma mensagem de WhatsApp é enviada automaticamente pelo checkout. O navegador abre a conversa para que o próprio comprador revise e envie.</p></aside>
    </>
  );
}
