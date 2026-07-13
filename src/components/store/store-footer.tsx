"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { Logo } from "@/components/ui/logo";
import { whatsappUrl } from "@/lib/format";

export function StoreFooter() {
  const { data, demoMode } = useStore();
  const message = "Ola! Vim pelo e-commerce demonstrativo da Junior Imports.";

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
            <Link href="/#destaques">Destaques</Link>
            <Link href="/#catalogo">Produtos</Link>
            <Link href="/#duvidas">Dúvidas</Link>
          </div>
          <div>
            <strong>Atendimento</strong>
            <a href={whatsappUrl(data.settings.whatsapp, message)} target="_blank" rel="noreferrer">WhatsApp</a>
            <span>{data.settings.hours}</span>
            <span>{data.settings.email}</span>
          </div>
          <div>
            <strong>Projeto</strong>
            <span>Ambiente demonstrativo</span>
            <span>{demoMode ? "Modo local ativo" : "Conectado ao Supabase"}</span>
            <Link className="footer-admin" href="/admin/login">Abrir painel administrativo</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 Junior Imports</span>
          <span>Projeto academico sem vendas reais.</span>
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
