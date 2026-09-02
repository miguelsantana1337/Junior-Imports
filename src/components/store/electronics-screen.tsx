"use client";

import { ArrowDown, Cpu, Headphones, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useStore } from "@/components/providers/store-provider";
import { ProductArt } from "@/components/ui/product-art";
import { electronicsCategorySlug, resolveElectronicsCatalog } from "@/lib/electronics-catalog";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";
import type { HomeSection, PageBlock } from "@/types/store";
import { CatalogSection } from "./catalog-section";

const electronicsSection: HomeSection = {
  id: "electronics-catalog",
  kind: "catalog",
  name: "Eletrônicos",
  eyebrow: "SOMENTE ELETRÔNICOS",
  title: "Tecnologia selecionada para comprar com clareza.",
  subtitle: "Busque por modelo, compare as opções e finalize com atendimento humano.",
  active: true,
  order: 1,
};

const electronicsBlock: PageBlock = {
  id: "electronics-catalog-block",
  pageId: "electronics",
  kind: "catalog",
  name: "Catálogo de eletrônicos",
  eyebrow: "",
  title: "",
  body: "",
  buttonText: "",
  buttonLink: "",
  imageUrl: "",
  backgroundColor: "",
  textColor: "",
  containerWidth: "normal",
  padding: "large",
  columns: 4,
  active: true,
  order: 1,
};

export function ElectronicsScreen() {
  const { data } = useStore();
  const catalog = useMemo(
    () => resolveElectronicsCatalog(data.products, data.categories),
    [data.categories, data.products],
  );
  const activeProducts = catalog.products
    .filter((product) => product.active)
    .sort((a, b) => a.order - b.order);
  const spotlight = activeProducts[0];
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const productHref = spotlight
    ? storeHref(`/produtos/${spotlight.slug}`)
    : storeHref(`/#catalogo`);

  return (
    <div className="electronics-storefront" data-catalog-scope={electronicsCategorySlug}>
      <section className="electronics-hero" aria-labelledby="electronics-title">
        <div className="container electronics-hero-grid">
          <div className="electronics-hero-copy">
            <span className="electronics-kicker"><Cpu aria-hidden="true" /> JUNIOR IMPORTS · ELETRÔNICOS</span>
            <h1 id="electronics-title">Tecnologia Apple,<br /><em>direta ao ponto.</em></h1>
            <p>Encontre seu próximo eletrônico, confira os detalhes e tire suas dúvidas com a equipe antes de comprar.</p>
            <div className="electronics-hero-actions">
              <a className="button button-primary button-large" href="#catalogo"><ArrowDown /> Ver eletrônicos</a>
              <a className="button button-ghost button-large" href="#como-comprar">Como comprar</a>
            </div>
            <div className="electronics-scope-points" aria-label="Características desta página">
              <span><Headphones /> Atendimento antes da compra</span>
              <span><ShoppingBag /> Carrinho e pedido online</span>
            </div>
          </div>

          <Link className={`electronics-spotlight ${spotlight ? "has-product" : "is-empty"}`} href={productHref} aria-label={spotlight ? `Ver ${spotlight.name}` : "Ver catálogo de eletrônicos"}>
            <div className="electronics-circuit" aria-hidden="true" />
            {spotlight ? <>
              <div className="electronics-product-art"><ProductArt product={spotlight} large /></div>
              <footer>
                <span>{spotlight.brand || "Eletrônicos"}</span>
                <strong>{spotlight.name}</strong>
                <b>{formatMoney(spotlight.price)}</b>
              </footer>
            </> : <div className="electronics-empty-visual"><Cpu /><strong>Novos eletrônicos aparecerão aqui.</strong></div>}
          </Link>
        </div>
      </section>

      <aside className="electronics-scope-note">
        <div className="container">
          <strong>{activeProducts.length} {activeProducts.length === 1 ? "produto disponível" : "produtos disponíveis"}</strong>
          <span>Esta loja mostra somente os eletrônicos publicados pela Junior Imports.</span>
        </div>
      </aside>

      <CatalogSection
        section={electronicsSection}
        block={electronicsBlock}
        products={catalog.products}
        categories={catalog.categories}
        searchPlaceholder="Busque por eletrônico, modelo ou marca"
        emptyMessage="Quando um eletrônico for publicado no painel, ele aparecerá automaticamente aqui."
      />

      <section className="electronics-purchase-guide" id="como-comprar" aria-labelledby="electronics-guide-title">
        <div className="container">
          <header>
            <span className="electronics-kicker">COMPRA ACOMPANHADA</span>
            <h2 id="electronics-guide-title">Do modelo certo ao pedido confirmado.</h2>
            <p>A loja organiza sua escolha. A equipe confirma disponibilidade, condição e atendimento pelo WhatsApp.</p>
          </header>
          <div className="electronics-purchase-steps">
            <article><span>01</span><h3>Escolha o produto</h3><p>Consulte modelos, capacidades e valores disponíveis no catálogo.</p></article>
            <article><span>02</span><h3>Revise no carrinho</h3><p>Confira os itens e informe os dados necessários para registrar o pedido.</p></article>
            <article><span>03</span><h3>Confirme com a equipe</h3><p>Finalize e continue o atendimento no WhatsApp oficial da Junior Imports.</p></article>
          </div>
        </div>
      </section>
    </div>
  );
}
