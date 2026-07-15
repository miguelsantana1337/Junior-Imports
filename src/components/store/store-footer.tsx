"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { Logo } from "@/components/ui/logo";
import { whatsappUrl } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function StoreFooter() {
  const { data, demoMode } = useStore();
  const message = `Olá! Vim pelo e-commerce demonstrativo da ${data.settings.storeName}.`;
  const navigationPages = data.pages.filter((page) => page.active && page.showInNavigation && !page.isHome).sort((a, b) => a.order - b.order);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);

  return (
    <>
      <footer className="store-footer">
        <div className="container footer-grid">
          <div>
            <Logo />
            <p>{data.settings.footerDescription}</p>
          </div>
          <div>
            <strong>Loja</strong>
            <Link href={storeHref("/#destaques")}>Destaques</Link>
            <Link href={storeHref("/#catalogo")}>Produtos</Link>
            <Link href={storeHref("/#duvidas")}>Dúvidas</Link>
            {navigationPages.map((page) => <Link href={storeHref(`/paginas/${page.slug}`)} key={page.id}>{page.name}</Link>)}
          </div>
          <div>
            <strong>Atendimento</strong>
            <a href={whatsappUrl(data.settings.whatsapp, message)} target="_blank" rel="noreferrer">WhatsApp</a>
            <span>{data.settings.hours}</span>
            <span>{data.settings.email}</span>
          </div>
          <div>
            <strong>Operação</strong>
            <span>{data.settings.checkoutMode === "whatsapp" ? "Pedidos pelo WhatsApp" : "Ambiente demonstrativo"}</span>
            <span>{demoMode ? "Modo local ativo" : "Conectado ao Supabase"}</span>
            <Link className="footer-admin" href="/admin/login">Abrir painel administrativo</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 {data.settings.storeName}</span>
          <span>{data.settings.checkoutMode === "whatsapp" ? "Atendimento e fechamento realizados pela loja." : "Projeto demonstrativo sem vendas reais."}</span>
        </div>
      </footer>
      <a
        className="whatsapp-float"
        href={whatsappUrl(data.settings.whatsapp, message)}
        target="_blank"
        rel="noreferrer"
        aria-label="Atendimento pelo WhatsApp"
      >
        <MessageCircle />
      </a>
    </>
  );
}
