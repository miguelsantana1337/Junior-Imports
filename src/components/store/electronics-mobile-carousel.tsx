"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ProductArt } from "@/components/ui/product-art";
import { electronicsBannerKeys, electronicsHomeHref } from "@/lib/electronics-home";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";
import type { PageBlock, StorefrontProduct } from "@/types/store";

export function ElectronicsMobileCarousel({
  content,
  spotlight,
  seconds,
  storefrontPath = "",
}: {
  content: Record<(typeof electronicsBannerKeys)[number], PageBlock>;
  spotlight?: StorefrontProduct;
  seconds: number;
  storefrontPath?: string;
}) {
  const slides = useMemo(
    () => electronicsBannerKeys.map((key) => content[key]).filter((block) => block.active),
    [content],
  );
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [touching, setTouching] = useState(false);
  const interacting = hovered || focused || touching;
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const visibleIndex = slides.length ? active % slides.length : 0;
  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);

  useEffect(() => {
    if (slides.length < 2 || paused || interacting) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const mobile = window.matchMedia("(max-width: 700px)");
    let timer: number | undefined;
    const syncTimer = () => {
      window.clearInterval(timer);
      if (reducedMotion.matches || !mobile.matches || document.hidden) return;
      timer = window.setInterval(() => setActive((current) => (current + 1) % slides.length), Math.max(3, Number.isFinite(seconds) ? seconds : 5) * 1000);
    };
    syncTimer();
    reducedMotion.addEventListener("change", syncTimer);
    mobile.addEventListener("change", syncTimer);
    document.addEventListener("visibilitychange", syncTimer);
    return () => {
      window.clearInterval(timer);
      reducedMotion.removeEventListener("change", syncTimer);
      mobile.removeEventListener("change", syncTimer);
      document.removeEventListener("visibilitychange", syncTimer);
    };
  }, [interacting, paused, seconds, slides.length]);

  if (!slides.length) return null;

  return (
    <section className="electronics-mobile-carousel" aria-label="Destaques da loja" aria-roledescription="carrossel" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <div className="electronics-mobile-slides" onTouchStart={(event) => { const touch = event.touches[0]; touchStart.current = { x: touch.clientX, y: touch.clientY }; setTouching(true); }} onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0];
        if (start && end && slides.length > 1) {
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            event.preventDefault();
            move(dx < 0 ? 1 : -1);
          }
        }
        touchStart.current = null;
        setTouching(false);
      }} onTouchCancel={() => { touchStart.current = null; setTouching(false); }}>
        {slides.map((slide, index) => {
          const isPrimaryProduct = slide.id === content.hero.id && !slide.imageUrl && spotlight;
          return <article className={`electronics-mobile-slide ${index === visibleIndex ? "active" : ""}`} key={slide.id} aria-hidden={index !== visibleIndex} inert={index !== visibleIndex} aria-roledescription="slide" aria-label={`Banner ${index + 1} de ${slides.length}`}>
            {slide.imageUrl && <Image className="electronics-mobile-banner-image" src={slide.imageUrl} alt={slide.title} fill sizes="100vw" unoptimized priority={index === 0} />}
            {isPrimaryProduct && <div className="electronics-mobile-product"><ProductArt product={spotlight} large /></div>}
            <div className="electronics-mobile-shade" aria-hidden="true" />
            <div className="electronics-mobile-banner-copy">
              <span>{slide.eyebrow}</span>
              <h1>{slide.title}</h1>
              {slide.body && <p>{slide.body}</p>}
              <div>
                {isPrimaryProduct && <div className="electronics-banner-price"><small>{spotlight.name}</small><strong>{formatMoney(spotlight.price)}</strong><small>{spotlight.madeToOrder ? "Sob encomenda" : "Valor do produto em destaque"}</small></div>}
                <Link href={withStorefrontPath(storefrontPath, electronicsHomeHref(slide.buttonLink))}>{slide.buttonText}<ArrowRight /></Link>
              </div>
            </div>
          </article>;
        })}
      </div>
      {slides.length > 1 && <div className="electronics-mobile-carousel-controls">
        <button type="button" onClick={() => move(-1)} aria-label="Banner anterior"><ChevronLeft /></button>
        <div className="electronics-mobile-dots" aria-label="Selecionar banner">
          {slides.map((slide, index) => <button type="button" className={index === visibleIndex ? "active" : ""} key={slide.id} onClick={() => setActive(index)} aria-label={`Exibir banner ${index + 1}`} aria-current={index === visibleIndex ? "true" : undefined}><span /></button>)}
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Próximo banner"><ChevronRight /></button>
        <button type="button" onClick={() => setPaused((value) => !value)} aria-label={paused ? "Retomar rotação dos banners" : "Pausar rotação dos banners"} aria-pressed={paused}>{paused ? <Play /> : <Pause />}</button>
      </div>}
    </section>
  );
}
