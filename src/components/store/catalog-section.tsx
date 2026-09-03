"use client";

import { Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { buildCatalogProductGroups, type CatalogSort } from "@/lib/catalog-view";
import type { Category, HomeSection, PageBlock, StorefrontProduct } from "@/types/store";
import { ProductCarousel } from "./product-carousel";
import { SectionHeading } from "./section-heading";

export function CatalogSection({
  section,
  block,
  products,
  categories,
  desktopColumns,
  searchPlaceholder = "O que você está procurando? Busque por produto, marca ou categoria",
  emptyMessage = "Tente outro termo de busca.",
}: {
  section: HomeSection;
  block: PageBlock;
  products?: StorefrontProduct[];
  categories?: Category[];
  desktopColumns?: number;
  searchPlaceholder?: string;
  emptyMessage?: string;
}) {
  const { data } = useStore();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<CatalogSort>("order");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    if (initial) setSearch(initial);
    const listener = (event: Event) => setSearch((event as CustomEvent<string>).detail);
    window.addEventListener("junior-search", listener);
    return () => window.removeEventListener("junior-search", listener);
  }, []);

  const groups = useMemo(
    () => buildCatalogProductGroups(products ?? data.products, categories ?? data.categories, search, sort),
    [categories, data.categories, data.products, products, search, sort],
  );
  const productCount = groups.reduce((total, group) => total + group.products.length, 0);

  function goToCategory(slug: string) {
    document.querySelector(`#categoria-${CSS.escape(slug)}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className={`section catalog-section page-block-shell padding-${block.padding}`} id="catalogo" style={{ backgroundColor: block.backgroundColor || undefined, color: block.textColor || undefined }}>
      <div className={`container page-block-container width-${block.containerWidth}`}>
        <SectionHeading eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />
        <label className="catalog-search-field">
          <Search aria-hidden="true" />
          <span className="sr-only">Buscar no catálogo</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchPlaceholder} />
          {search && <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca"><X /></button>}
        </label>
        <div className="catalog-toolbar">
          <nav className="category-filters" aria-label="Atalhos para categorias">
            {groups.map((group) => (
              <button type="button" key={group.id} onClick={() => goToCategory(group.slug)}>
                {group.name}
              </button>
            ))}
          </nav>
          <label className="select-wrap">Ordenar<select value={sort} onChange={(event) => setSort(event.target.value as CatalogSort)}><option value="order">Ordem da loja</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A-Z</option></select></label>
        </div>
        <div className="catalog-status"><span>{search ? <>Resultados para <strong>{search}</strong></> : <>{productCount} produto{productCount === 1 ? "" : "s"}</>}</span><span>{groups.length} categoria{groups.length === 1 ? "" : "s"}</span></div>
        {groups.length
          ? <div className="catalog-category-list">{groups.map((group) => <ProductCarousel group={group} key={group.id} desktopColumns={desktopColumns} />)}</div>
          : <div className="empty-state"><strong>Nenhum produto encontrado.</strong><p>{search ? "Tente outro nome, modelo ou marca." : emptyMessage}</p>{search && <button className="button button-ghost" onClick={() => setSearch("")}>Limpar busca</button>}</div>}
      </div>
    </section>
  );
}
