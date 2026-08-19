"use client";

import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { useStore } from "@/components/providers/store-provider";
import type { HomeSection, PageBlock } from "@/types/store";
import { withStorefrontPath } from "@/lib/storefront-path";
import { formatMoney } from "@/lib/format";
import { ensurePurchaseFaqBlock, resolvePurchaseFaqs } from "@/lib/storefront-commerce";
import { isStorePromotionActive } from "@/lib/store-promotion";
import { CatalogSection } from "./catalog-section";
import { HeroCarousel } from "./hero-carousel";
import { ProductCard } from "./product-card";
import { SectionHeading } from "./section-heading";
import { TrustStrip } from "./trust-strip";
import { StorePromotion } from "./store-promotion";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

export function StorePageRenderer({ pageId }: { pageId: string }) {
  const { data } = useStore();
  const page = data.pages.find((item) => item.id === pageId);
  const sourceBlocks = data.pageBlocks.filter((block) => block.pageId === pageId && block.active).sort((a, b) => a.order - b.order);
  const blocks = ensurePurchaseFaqBlock(sourceBlocks, Boolean(page?.isHome));

  if (!page || !page.active) return null;
  if (!blocks.length) return <section className="page-state container"><span className="section-kicker">{page.name}</span><h1>{page.title}</h1><p>{page.description}</p></section>;

  return <div className="store-page" data-page={page.slug}>{blocks.map((block) => <Fragment key={block.id}><PageBlockRenderer block={block} />{page.isHome && block.kind === "hero" && <StorePromotion />}</Fragment>)}</div>;
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
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  if (block.kind === "hero") return <HeroCarousel />;
  if (block.kind === "trust") return <TrustStrip block={block} />;

  const section = getSection(block, data.sections);
  if (block.kind === "catalog") return <CatalogSection section={section} block={block} />;

  if (block.kind === "featured") {
    const products = data.products.filter((product) => product.active && product.featured).sort((a, b) => a.order - b.order);
    const actionText = block.buttonText || "Ver catálogo completo →";
    const actionLink = block.buttonLink || "/#catalogo";
    return <BlockShell block={block} id="destaques"><SectionHeading eyebrow={section.eyebrow} title={section.title} subtitle={section.subtitle} action={actionText ? <Link className="text-link" href={storeHref(actionLink)}>{actionText}</Link> : undefined} /><div className="product-grid page-block-grid" style={{ "--block-columns": block.columns } as React.CSSProperties}>{products.map((product) => <ProductCard product={product} key={product.id} />)}</div></BlockShell>;
  }

  if (block.kind === "promo") {
    if (data.settings.promotionEnabled && !isStorePromotionActive(data.settings)) return null;
    const shippingValue = formatMoney(data.settings.freeShippingThreshold);
    const eyebrow = block.eyebrow || data.settings.freeShippingBannerEyebrow;
    const campaignTitle = (block.title || data.settings.freeShippingBannerTitle).replaceAll("{{valor}}", shippingValue);
    const subtitle = block.body || data.settings.freeShippingBannerSubtitle;
    const buttonText = block.buttonText || data.settings.freeShippingBannerButtonText || "Ver produtos";
    const buttonLink = block.buttonLink || data.settings.freeShippingBannerButtonLink || "/#catalogo";
    return <BlockShell block={block}><div className="promo-card"><div><span className="section-kicker">{eyebrow}</span><h2>{campaignTitle}</h2><p>{subtitle}</p></div>{buttonText && <Link className="button button-light button-large" href={storeHref(buttonLink)}>{buttonText}</Link>}</div></BlockShell>;
  }

  if (block.kind === "benefits") {
    return <BlockShell block={block} id="beneficios"><SectionHeading eyebrow={section.eyebrow} title={section.title} /><div className="benefits-grid page-block-grid" style={{ "--block-columns": block.columns } as React.CSSProperties}>{[...data.benefits].sort((a, b) => a.order - b.order).map((item, index) => <article className="benefit-card" key={item.id}><span>0{index + 1}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div></BlockShell>;
  }

  if (block.kind === "faq") {
    return <BlockShell block={block} id="duvidas"><div className="faq-grid"><div><span className="section-kicker">{section.eyebrow || "PERGUNTAS FREQUENTES"}</span><h2>{section.title || "Como comprar na Junior Imports."}</h2><p className="faq-intro">{section.subtitle || "Veja como escolher os produtos, finalizar o pedido e continuar o atendimento pelo WhatsApp."}</p></div><div className="faq-list">{resolvePurchaseFaqs(data.faqs).map((faq, index) => <details key={faq.id} open={index === 0 ? true : undefined}><summary>{faq.question}</summary><p>{faq.answer}</p></details>)}</div></div></BlockShell>;
  }

  if (block.kind === "spacer") return <div className={`page-spacer padding-${block.padding}`} aria-hidden="true" />;

  if (block.kind === "image") {
    const media = <figure className="page-image-block"><Image loader={passthroughLoader} unoptimized fill sizes="100vw" src={block.imageUrl} alt={block.title || block.name} /><figcaption>{block.body}</figcaption></figure>;
    return <BlockShell block={block}>{block.buttonLink ? <Link href={storeHref(block.buttonLink)} aria-label={block.buttonText || block.title || block.name}>{media}</Link> : media}</BlockShell>;
  }

  if (block.kind === "cta") {
    return <BlockShell block={block}><div className="page-cta-block"><div><span className="section-kicker">{block.eyebrow}</span><h2>{block.title}</h2><p>{block.body}</p></div>{block.buttonText && <Link className="button button-light button-large" href={storeHref(block.buttonLink || "/")}>{block.buttonText}</Link>}</div></BlockShell>;
  }

  return <BlockShell block={block}><div className="page-text-block"><span className="section-kicker">{block.eyebrow}</span>{block.pageId === "home" ? <h2>{block.title}</h2> : <h1>{block.title}</h1>}<p>{block.body}</p>{block.buttonText && <Link className="button button-primary button-large" href={storeHref(block.buttonLink || "/")}>{block.buttonText}</Link>}</div></BlockShell>;
}

function BlockShell({ block, children, id }: { block: PageBlock; children: React.ReactNode; id?: string }) {
  return <section id={id} className={`page-block-shell padding-${block.padding}`} style={{ backgroundColor: block.backgroundColor || undefined, color: block.textColor || undefined }}><div className={`page-block-container width-${block.containerWidth}`}>{children}</div></section>;
}
