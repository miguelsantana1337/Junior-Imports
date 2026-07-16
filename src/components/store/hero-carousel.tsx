"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { whatsappUrl } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function HeroCarousel() {
  const { data } = useStore();
  const banners = useMemo(
    () => data.banners.filter((banner) => banner.active).sort((a, b) => a.order - b.order),
    [data.banners],
  );
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (banners.length < 2 || paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % banners.length),
      Math.max(3, data.settings.autoBannerSeconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [banners.length, data.settings.autoBannerSeconds, paused]);

  if (!banners.length) return null;

  const visibleIndex = active % banners.length;
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);

  return (
    <section
      className="hero-carousel"
      aria-label="Destaques da loja"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
      }}
    >
      <div className="hero-slides">
        {banners.map((banner, index) => {
          const [before, after] = banner.highlight
            ? banner.title.split(banner.highlight)
            : [banner.title, ""];
          const desktopImage = banner.imageUrl || banner.mobileImageUrl;
          const mobileImage = banner.mobileImageUrl || banner.imageUrl;
          return (
            <article
              className={`hero-slide ${banner.imageOnly ? "image-only" : ""} ${index === visibleIndex ? "active" : ""}`}
              key={banner.id}
              style={{
                "--banner-start": banner.startColor,
                "--banner-end": banner.endColor,
              } as React.CSSProperties}
              aria-hidden={index !== visibleIndex}
              inert={index !== visibleIndex}
            >
              {desktopImage && (
                <div className="hero-image hero-image-desktop" style={{ backgroundImage: `url(${desktopImage})` }} role="img" aria-label={banner.altText || undefined} />
              )}
              {mobileImage && (
                <div className="hero-image hero-image-mobile" style={{ backgroundImage: `url(${mobileImage})` }} role="img" aria-label={banner.altText || undefined} />
              )}
              {banner.imageOnly && <Link className="hero-image-link" href={storeHref(banner.buttonLink || "#catalogo")} aria-label={banner.altText || banner.title || `Abrir banner ${index + 1}`} />}
              {!banner.imageOnly && <div className="container hero-content">
                <div className="hero-copy">
                  <span className="hero-kicker">{banner.kicker}</span>
                  <h1>{before}{banner.highlight && <span>{banner.highlight}</span>}{after}</h1>
                  <p>{banner.subtitle}</p>
                  <div className="hero-actions">
                    <Link className="button button-primary button-large" href={storeHref(banner.buttonLink)}>{banner.buttonText}</Link>
                    <a className="button button-ghost button-large" href={whatsappUrl(data.settings.whatsapp, `Olá! Quero saber mais sobre as ofertas da ${data.settings.storeName}.`)} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
                  </div>
                </div>
              </div>}
            </article>
          );
        })}
      </div>
      <div className="container hero-controls">
        <div className="hero-dots">
          {banners.map((banner, index) => (
            <button className={index === visibleIndex ? "active" : ""} key={banner.id} onClick={() => setActive(index)} aria-label={`Exibir banner ${index + 1}`} />
          ))}
        </div>
        <div className="hero-arrows">
          <button onClick={() => setActive((visibleIndex - 1 + banners.length) % banners.length)} aria-label="Banner anterior"><ArrowLeft /></button>
          <button onClick={() => setActive((visibleIndex + 1) % banners.length)} aria-label="Proximo banner"><ArrowRight /></button>
        </div>
      </div>
    </section>
  );
}
