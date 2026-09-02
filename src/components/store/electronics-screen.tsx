"use client";

import { ArrowDown, Cpu, Layers3, ShoppingBag } from "lucide-react";
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
  title: "Tecnologia selecionada em uma página própria.",
  subtitle: "Busque, compare e compre sem misturar categorias.",
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
    : storeHref(`/eletronicos#catalogo`);

  return (
    <div className="electronics-storefront" data-catalog-scope={electronicsCategorySlug}>
      <section className="electronics-hero" aria-labelledby="electronics-title">
        <div className="container electronics-hero-grid">
          <div className="electronics-hero-copy">
            <span className="electronics-kicker"><Cpu aria-hidden="true" /> VITRINE DE TECNOLOGIA</span>
            <h1 id="electronics-title">Eletrônicos,<br /><em>sem misturar catálogos.</em></h1>
            <p>Uma área separada da Junior Imports que mostra exclusivamente os produtos cadastrados na categoria Eletrônicos.</p>
            <div className="electronics-hero-actions">
              <a className="button button-primary button-large" href="#catalogo"><ArrowDown /> Ver eletrônicos</a>
              <Link className="button button-ghost button-large" href={storeHref("/")}>Voltar à loja completa</Link>
            </div>
            <div className="electronics-scope-points" aria-label="Características desta página">
              <span><Layers3 /> Categoria exclusiva</span>
              <span><ShoppingBag /> Mesmo carrinho e checkout</span>
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
          <span>As buscas e listagens desta página consideram apenas a categoria Eletrônicos.</span>
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
    </div>
  );
}
