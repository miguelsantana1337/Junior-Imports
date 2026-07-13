"use client";

import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { HeroCarousel } from "./hero-carousel";
import { TrustStrip } from "./trust-strip";
import { CatalogSection } from "./catalog-section";
import { ProductCard } from "./product-card";
import { SectionHeading } from "./section-heading";
import type { HomeSection } from "@/types/store";

export function HomeScreen() {
  const { data } = useStore();
  const sections = data.sections.filter((section) => section.active).sort((a, b) => a.order - b.order);
  return (
    <>
      <HeroCarousel />
      <TrustStrip />
      {sections.map((section) => <HomeSectionRenderer section={section} key={section.id} />)}
    </>
  );
}

function HomeSectionRenderer({ section }: { section: HomeSection }) {
  const { data } = useStore();
  if (section.kind === "catalog") return <CatalogSection section={section} />;
  if (section.kind === "featured") {
    const products = data.products.filter((product) => product.active && product.featured).sort((a, b) => a.order - b.order).slice(0, 8);
    return <section className="section" id="destaques"><div className="container"><SectionHeading eyebrow={section.eyebrow} title={section.title} action={<Link className="text-link" href="#catalogo">Ver catálogo completo →</Link>} /><div className="product-grid">{products.map((product) => <ProductCard product={product} key={product.id} />)}</div></div></section>;
  }
  if (section.kind === "promo") {
    return <section className="section"><div className="container"><div className="promo-card"><div><span className="section-kicker">{section.eyebrow}</span><h2>{section.title}</h2><p>{section.subtitle}</p></div><Link className="button button-light button-large" href={section.buttonLink ?? "#catalogo"}>{section.buttonText ?? "Ver produtos"}</Link></div></div></section>;
  }
  if (section.kind === "benefits") {
    return <section className="section" id="beneficios"><div className="container"><SectionHeading eyebrow={section.eyebrow} title={section.title} /><div className="benefits-grid">{[...data.benefits].sort((a, b) => a.order - b.order).map((item, index) => <article className="benefit-card" key={item.id}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></div></section>;
  }
  return <section className="section" id="duvidas"><div className="container faq-grid"><div><span className="section-kicker">{section.eyebrow}</span><h2>{section.title}</h2></div><div className="faq-list">{[...data.faqs].sort((a, b) => a.order - b.order).map((faq, index) => <details key={faq.id} open={index === 0 ? true : undefined}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></section>;
}
