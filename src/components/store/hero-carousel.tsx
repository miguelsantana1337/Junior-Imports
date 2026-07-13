"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/components/providers/store-provider";
import { whatsappUrl } from "@/lib/format";

export function HeroCarousel() {
  const { data } = useStore();
  const banners = useMemo(
    () => data.banners.filter((banner) => banner.active).sort((a, b) => a.order - b.order),
    [data.banners],
  );
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (banners.length < 2) return;
    const timer = window.setInterval(
      () => setActive((current) => (current + 1) % banners.length),
      Math.max(3, data.settings.autoBannerSeconds) * 1000,
    );
    return () => window.clearInterval(timer);
  }, [banners.length, data.settings.autoBannerSeconds]);

  if (!banners.length) return null;

  const visibleIndex = active % banners.length;

  return (
    <section className="hero-carousel" aria-label="Ofertas em destaque">
      <div className="hero-slides">
        {banners.map((banner, index) => {
          const [before, after] = banner.highlight
            ? banner.title.split(banner.highlight)
            : [banner.title, ""];
          return (
            <article
              className={`hero-slide ${banner.imageOnly ? "image-only" : ""} ${index === visibleIndex ? "active" : ""}`}
              key={banner.id}
              style={{
                "--banner-start": banner.startColor,
                "--banner-end": banner.endColor,
              } as React.CSSProperties}
              aria-hidden={index !== visibleIndex}
            >
              {banner.imageUrl && (
                <div className="hero-image" style={{ backgroundImage: `url(${banner.imageUrl})` }} />
              )}
              {banner.imageOnly && <Link className="hero-image-link" href={banner.buttonLink || "#catalogo"} aria-label={banner.title || `Abrir banner ${index + 1}`} />}
              {!banner.imageOnly && <div className="container hero-content">
                <div className="hero-copy">
                  <span className="hero-kicker">{banner.kicker}</span>
                  <h1>{before}{banner.highlight && <span>{banner.highlight}</span>}{after}</h1>
                  <p>{banner.subtitle}</p>
                  <div className="hero-actions">
                    <Link className="button button-primary button-large" href={banner.buttonLink}>{banner.buttonText}</Link>
                    <a className="button button-ghost button-large" href={whatsappUrl(data.settings.whatsapp, "Olá! Quero saber mais sobre as ofertas da Junior Imports.")} target="_blank" rel="noreferrer">Falar no WhatsApp</a>
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
