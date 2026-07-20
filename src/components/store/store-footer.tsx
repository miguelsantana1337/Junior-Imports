"use client";

import Link from "next/link";
import { Clock3, Mail, MessageCircle, ShieldCheck, ShoppingBag } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { Logo } from "@/components/ui/logo";
import { formatWhatsappDisplay, whatsappUrl } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function StoreFooter() {
  const { data } = useStore();
  const message = `Olá! Vim pela loja da ${data.settings.storeName} e gostaria de tirar uma dúvida.`;
  const navigationPages = data.pages.filter((page) => page.active && page.showInNavigation && !page.isHome).sort((a, b) => a.order - b.order);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const whatsappHref = whatsappUrl(data.settings.whatsapp, message);
  const whatsappLabel = formatWhatsappDisplay(data.settings.whatsapp);

  return (
    <>
      <footer className="store-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>{data.settings.footerDescription}</p>
            <a className="footer-whatsapp-link" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle /> Comprar pelo WhatsApp</a>
            <small>Atendimento oficial: {whatsappLabel}</small>
          </div>
          <div>
            <strong>Loja</strong>
            <Link href={storeHref("/")}>Início</Link>
            <Link href={storeHref("/#destaques")}>Destaques</Link>
            <Link href={storeHref("/#catalogo")}>Produtos</Link>
            <Link href={storeHref("/#duvidas")}>Como comprar</Link>
            {navigationPages.map((page) => <Link href={storeHref(`/paginas/${page.slug}`)} key={page.id}>{page.name}</Link>)}
          </div>
          <div>
            <strong>Atendimento</strong>
            <a className="footer-contact-line" href={whatsappHref} target="_blank" rel="noreferrer"><MessageCircle /> {whatsappLabel}</a>
            <span className="footer-contact-line"><Clock3 /> {data.settings.hours}</span>
            <a className="footer-contact-line" href={`mailto:${data.settings.email}`}><Mail /> {data.settings.email}</a>
          </div>
          <div>
            <strong>Compra segura</strong>
            <Link href={storeHref("/#catalogo")}><ShoppingBag /> Escolha seus produtos</Link>
            <Link href={storeHref("/#duvidas")}><ShieldCheck /> Pagamento, envio e garantia</Link>
            <span>Pedido registrado no site</span>
            <span>Confirmação pelo WhatsApp</span>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} {data.settings.storeName}. Todos os direitos reservados.</span>
          <div><span><ShieldCheck /> Compra protegida</span><span><MessageCircle /> Atendimento humano</span></div>
        </div>
      </footer>
      <a
        className="whatsapp-float"
        href={whatsappHref}
        target="_blank"
        rel="noreferrer"
        aria-label="Atendimento pelo WhatsApp"
      >
        <MessageCircle />
      </a>
    </>
  );
}
