"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import type { HomeSection } from "@/types/store";
import { ProductCard } from "./product-card";
import { SectionHeading } from "./section-heading";

type Sort = "order" | "price-asc" | "price-desc" | "name";

export function CatalogSection({ section }: { section: HomeSection }) {
  const { data } = useStore();
  const [category, setCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>("order");

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get("q") ?? "";
    if (initial) setSearch(initial);
    const listener = (event: Event) => setSearch((event as CustomEvent<string>).detail);
    window.addEventListener("junior-search", listener);
    return () => window.removeEventListener("junior-search", listener);
  }, []);

  const products = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return data.products
      .filter((product) => product.active)
      .filter((product) => category === "Todos" || product.category === category)
      .filter((product) =>
        !term || [product.name, product.category, product.brand, product.description]
          .some((value) => value.toLocaleLowerCase("pt-BR").includes(term)),
      )
      .sort((a, b) => {
        if (sort === "price-asc") return a.price - b.price;
        if (sort === "price-desc") return b.price - a.price;
        if (sort === "name") return a.name.localeCompare(b.name, "pt-BR");
        return a.order - b.order;
      });
  }, [category, data.products, search, sort]);

  const categories = data.categories.filter((item) => item.active).sort((a, b) => a.order - b.order);

  return (
    <section className="section" id="catalogo">
      <div className="container">
        <SectionHeading eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} />
        {search && (
          <div className="catalog-search-state">
            Resultados para <strong>{search}</strong>
            <button onClick={() => setSearch("")}>Limpar busca</button>
          </div>
        )}
        <div className="catalog-toolbar">
          <div className="category-filters">
            <button className={category === "Todos" ? "active" : ""} onClick={() => setCategory("Todos")}>Todos</button>
            {categories.map((item) => <button className={category === item.name ? "active" : ""} key={item.id} onClick={() => setCategory(item.name)}>{item.name}</button>)}
          </div>
          <label className="select-wrap">Ordenar<select value={sort} onChange={(event) => setSort(event.target.value as Sort)}><option value="order">Ordem da loja</option><option value="price-asc">Menor preço</option><option value="price-desc">Maior preço</option><option value="name">Nome A-Z</option></select></label>
        </div>
        <div className="catalog-status"><span>{products.length} produto{products.length === 1 ? "" : "s"}</span><span>{category === "Todos" ? "Todos os produtos" : category}</span></div>
        {products.length ? <div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div> : <div className="empty-state"><strong>Nenhum produto encontrado.</strong><p>Tente outro termo ou categoria.</p><button className="button button-ghost" onClick={() => { setCategory("Todos"); setSearch(""); }}>Limpar filtros</button></div>}
      </div>
    </section>
  );
}
