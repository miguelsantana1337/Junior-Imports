"use client";

import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import type { HomeSection, PageBlock } from "@/types/store";
import { CatalogSection } from "./catalog-section";
import { HeroCarousel } from "./hero-carousel";
import { ProductCard } from "./product-card";
import { SectionHeading } from "./section-heading";
import { TrustStrip } from "./trust-strip";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

export function StorePageRenderer({ pageId }: { pageId: string }) {
  const { data } = useStore();
  const page = data.pages.find((item) => item.id === pageId);
  const blocks = data.pageBlocks.filter((block) => block.pageId === pageId && block.active).sort((a, b) => a.order - b.order);

  if (!page || !page.active) return null;
  if (!blocks.length) return <section className="page-state container"><span className="section-kicker">{page.name}</span><h1>{page.title}</h1><p>{page.description}</p></section>;

  return <div className="store-page" data-page={page.slug}>{blocks.map((block) => <PageBlockRenderer block={block} key={block.id} />)}</div>;
}

function getSection(block: PageBlock, sections: HomeSection[]): HomeSection {
  const source = sections.find((section) => section.kind === block.kind);
  return {
    id: block.id,
    kind: block.kind as HomeSection["kind"],
    name: block.name,
    eyebrow: block.eyebrow || source?.eyebrow || "",
    title: block.title || source?.title || "",
    subtitle: block.body || source?.subtitle || "",
    buttonText: block.buttonText || source?.buttonText || "",
    buttonLink: block.buttonLink || source?.buttonLink || "",
    active: block.active,
    order: block.order,
  };
}

function PageBlockRenderer({ block }: { block: PageBlock }) {
  const { data } = useStore();
  if (block.kind === "hero") return <HeroCarousel />;
  if (block.kind === "trust") return <TrustStrip />;

  const section = getSection(block, data.sections);
  if (block.kind === "catalog") return <CatalogSection section={section} />;

  if (block.kind === "featured") {
    const products = data.products.filter((product) => product.active && product.featured).sort((a, b) => a.order - b.order).slice(0, Math.max(4, block.columns * 2));
    return <BlockShell block={block}><SectionHeading eyebrow={section.eyebrow} title={section.title} action={<Link className="text-link" href="/#catalogo">Ver catálogo completo →</Link>} /><div className="product-grid page-block-grid" style={{ "--block-columns": block.columns } as React.CSSProperties}>{products.map((product) => <ProductCard product={product} key={product.id} />)}</div></BlockShell>;
  }

  if (block.kind === "promo") {
    return <BlockShell block={block}><div className="promo-card"><div><span className="section-kicker">{section.eyebrow}</span><h2>{section.title}</h2><p>{section.subtitle}</p></div><Link className="button button-light button-large" href={section.buttonLink || "/#catalogo"}>{section.buttonText || "Ver produtos"}</Link></div></BlockShell>;
  }

  if (block.kind === "benefits") {
    return <BlockShell block={block}><SectionHeading eyebrow={section.eyebrow} title={section.title} /><div className="benefits-grid page-block-grid" style={{ "--block-columns": block.columns } as React.CSSProperties}>{[...data.benefits].sort((a, b) => a.order - b.order).map((item, index) => <article className="benefit-card" key={item.id}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></BlockShell>;
  }

  if (block.kind === "faq") {
    return <BlockShell block={block}><div className="faq-grid"><div><span className="section-kicker">{section.eyebrow}</span><h2>{section.title}</h2></div><div className="faq-list">{[...data.faqs].sort((a, b) => a.order - b.order).map((faq, index) => <details key={faq.id} open={index === 0 ? true : undefined}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></BlockShell>;
  }

  if (block.kind === "spacer") return <div className={`page-spacer padding-${block.padding}`} aria-hidden="true" />;

  if (block.kind === "image") {
    const media = <figure className="page-image-block"><Image loader={passthroughLoader} unoptimized fill sizes="100vw" src={block.imageUrl} alt={block.title || block.name} /><figcaption>{block.body}</figcaption></figure>;
    return <BlockShell block={block}>{block.buttonLink ? <Link href={block.buttonLink} aria-label={block.buttonText || block.title || block.name}>{media}</Link> : media}</BlockShell>;
  }

  if (block.kind === "cta") {
    return <BlockShell block={block}><div className="page-cta-block"><div><span className="section-kicker">{block.eyebrow}</span><h2>{block.title}</h2><p>{block.body}</p></div>{block.buttonText && <Link className="button button-light button-large" href={block.buttonLink || "/"}>{block.buttonText}</Link>}</div></BlockShell>;
  }

  return <BlockShell block={block}><div className="page-text-block"><span className="section-kicker">{block.eyebrow}</span><h1>{block.title}</h1><p>{block.body}</p>{block.buttonText && <Link className="button button-primary button-large" href={block.buttonLink || "/"}>{block.buttonText}</Link>}</div></BlockShell>;
}

function BlockShell({ block, children }: { block: PageBlock; children: React.ReactNode }) {
  return <section className={`page-block-shell padding-${block.padding}`} style={{ backgroundColor: block.backgroundColor || undefined, color: block.textColor || undefined }}><div className={`page-block-container width-${block.containerWidth}`}>{children}</div></section>;
}
