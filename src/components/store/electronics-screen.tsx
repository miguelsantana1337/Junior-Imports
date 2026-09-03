"use client";

import { ArrowDown, Cpu, Headphones, ShoppingBag } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useMemo } from "react";
import { useStore } from "@/components/providers/store-provider";
import { ProductArt } from "@/components/ui/product-art";
import { electronicsCategorySlug, resolveElectronicsCatalog } from "@/lib/electronics-catalog";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";
import { electronicsHomeHref, resolveElectronicsHome } from "@/lib/electronics-home";
import { buildElectronicsProductGroups } from "@/lib/electronics-catalog-view";
import type { HomeSection, PageBlock } from "@/types/store";
import { CatalogSection } from "./catalog-section";
import { ElectronicsMobileCarousel } from "./electronics-mobile-carousel";

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
  const content = resolveElectronicsHome(data.tenant.id, data.pageBlocks);
  const catalog = useMemo(
    () => resolveElectronicsCatalog(data.products, data.categories),
    [data.categories, data.products],
  );
  const activeProducts = catalog.products
    .filter((product) => product.active)
    .sort((a, b) => a.order - b.order);
  const spotlight = activeProducts.find((product) => product.featured) ?? activeProducts[0];
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const productHref = spotlight
    ? storeHref(`/produtos/${spotlight.slug}`)
    : storeHref(`/#catalogo`);

  return (
    <div className="electronics-storefront" data-catalog-scope={electronicsCategorySlug}>
      <ElectronicsMobileCarousel content={content} spotlight={spotlight} seconds={data.settings.autoBannerSeconds} storefrontPath={data.tenant.storefrontPath} />
      <section className="electronics-hero" aria-labelledby="electronics-title">
        <div className="container electronics-hero-grid">
          <div className="electronics-hero-copy">
            <span className="electronics-kicker"><Cpu aria-hidden="true" /> {content.hero.eyebrow}</span>
            <h1 id="electronics-title">{content.hero.title.split("\n").map((line, index) => index === 0 ? <span key={index}>{line}</span> : <em key={index}><br />{line}</em>)}</h1>
            <p>{content.hero.body}</p>
            <div className="electronics-hero-actions">
              <a className="button button-primary button-large" href={electronicsHomeHref(content.hero.buttonLink)}><ArrowDown /> {content.hero.buttonText}</a>
              <a className="button button-ghost button-large" href="#como-comprar">Como comprar</a>
            </div>
            <div className="electronics-scope-points" aria-label="Características desta página">
              <span><Headphones /> Atendimento antes da compra</span>
              <span><ShoppingBag /> Carrinho e pedido online</span>
            </div>
          </div>

          <Link className={`electronics-spotlight ${spotlight || content.hero.imageUrl ? "has-product" : "is-empty"}`} href={content.hero.imageUrl ? electronicsHomeHref(content.hero.buttonLink) : productHref} aria-label={content.hero.imageUrl ? content.hero.title : spotlight ? `Ver ${spotlight.name}` : "Ver catálogo de eletrônicos"}>
            <div className="electronics-circuit" aria-hidden="true" />
            {content.hero.imageUrl ? <Image className="electronics-custom-hero" src={content.hero.imageUrl} alt={content.hero.title} width={1200} height={1200} unoptimized priority /> : spotlight ? <>
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
        section={{ ...electronicsSection, eyebrow: content.catalog.eyebrow, title: content.catalog.title, subtitle: content.catalog.body }}
        block={{ ...electronicsBlock, columns: content.catalog.columns }}
        desktopColumns={content.catalog.columns}
        products={catalog.products}
        categories={catalog.categories}
        searchPlaceholder="Busque por eletrônico, modelo ou marca"
        emptyMessage="Quando um eletrônico for publicado no painel, ele aparecerá automaticamente aqui."
        groupsBuilder={buildElectronicsProductGroups}
      />

      <section className="electronics-purchase-guide" id="como-comprar" aria-labelledby="electronics-guide-title">
        <div className="container">
          <header>
            <span className="electronics-kicker">{content.guide.eyebrow}</span>
            <h2 id="electronics-guide-title">{content.guide.title}</h2>
            <p>{content.guide.body}</p>
          </header>
          <div className="electronics-purchase-steps">
            {(["step-1", "step-2", "step-3"] as const).map((key, index) => <article key={key}><span>0{index + 1}</span><h3>{content[key].title}</h3><p>{content[key].body}</p></article>)}
          </div>
        </div>
      </section>
    </div>
  );
}
