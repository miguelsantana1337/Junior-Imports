"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { buildCatalogProductGroups, type CatalogSort } from "@/lib/catalog-view";
import type { HomeSection } from "@/types/store";
import { ProductCarousel } from "./product-carousel";
import { SectionHeading } from "./section-heading";

export function CatalogSection({ section }: { section: HomeSection }) {
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
    () => buildCatalogProductGroups(data.products, data.categories, search, sort),
    [data.categories, data.products, search, sort],
  );
  const productCount = groups.reduce((total, group) => total + group.products.length, 0);

  function goToCategory(slug: string) {
    document.querySelector(`#categoria-${CSS.escape(slug)}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <section className="section catalog-section" id="catalogo">
      <div className="container">
        <SectionHeading eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />
        {search && (
          <div className="catalog-search-state">
            Resultados para <strong>{search}</strong>
            <button onClick={() => setSearch("")}>Limpar busca</button>
          </div>
        )}
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
        <div className="catalog-status"><span>{productCount} produto{productCount === 1 ? "" : "s"}</span><span>{groups.length} categoria{groups.length === 1 ? "" : "s"}</span></div>
        {groups.length
          ? <div className="catalog-category-list">{groups.map((group) => <ProductCarousel group={group} key={group.id} />)}</div>
          : <div className="empty-state"><strong>Nenhum produto encontrado.</strong><p>Tente outro termo de busca.</p><button className="button button-ghost" onClick={() => setSearch("")}>Limpar busca</button></div>}
      </div>
    </section>
  );
}
