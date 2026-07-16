"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { CatalogProductGroup } from "@/lib/catalog-view";
import { ProductCard } from "./product-card";

export function ProductCarousel({ group }: { group: CatalogProductGroup }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const carouselId = `carrossel-${group.id}`;

  const updateControls = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setCanGoBack(viewport.scrollLeft > 4);
    setCanGoForward(viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateControls();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(updateControls);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [group.products.length, updateControls]);

  function move(direction: -1 | 1) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.max(280, viewport.clientWidth * 0.82),
      behavior: "smooth",
    });
  }

  return (
    <section className="catalog-category" id={`categoria-${group.slug}`} aria-labelledby={`${carouselId}-titulo`}>
      <header className="catalog-category-header">
        <div>
          <span>EXPLORAR CATEGORIA</span>
          <h3 id={`${carouselId}-titulo`}>{group.name}</h3>
          <p>{group.products.length} produto{group.products.length === 1 ? "" : "s"} {group.products.length === 1 ? "disponível" : "disponíveis"}</p>
        </div>
        <div className="product-carousel-controls" aria-label={`Navegar pela categoria ${group.name}`}>
          <button
            type="button"
            onClick={() => move(-1)}
            disabled={!canGoBack}
            aria-label={`Ver produtos anteriores de ${group.name}`}
            aria-controls={carouselId}
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={!canGoForward}
            aria-label={`Ver próximos produtos de ${group.name}`}
            aria-controls={carouselId}
          >
            <ChevronRight />
          </button>
        </div>
      </header>
      <div className="product-carousel-shell">
        <div
          className="product-carousel-viewport"
          id={carouselId}
          ref={viewportRef}
          onScroll={updateControls}
          tabIndex={0}
          aria-label={`Produtos da categoria ${group.name}`}
        >
          <div className="product-carousel-track">
            {group.products.map((product) => <ProductCard product={product} key={product.id} />)}
          </div>
        </div>
      </div>
    </section>
  );
}
