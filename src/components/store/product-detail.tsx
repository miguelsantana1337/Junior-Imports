"use client";
/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, Heart, MessageCircle, Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ProductArt } from "@/components/ui/product-art";
import { stockLabel } from "@/lib/commerce";
import { formatMoney, whatsappUrl } from "@/lib/format";
import { isProductPubliclySellable } from "@/lib/product-compliance";
import { normalizeProductImages } from "@/lib/product-images";
import { withStorefrontPath } from "@/lib/storefront-path";
import { ProductCard } from "./product-card";

export function ProductDetail({ slug }: { slug: string }) {
  const { data } = useStore();
  const { addItem, favorites, toggleFavorite, setDrawerOpen } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState("");
  const product = data.products.find((item) => item.slug === slug && item.active);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const related = useMemo(
    () => data.products.filter((item) => item.active && item.categoryId === product?.categoryId && item.id !== product?.id).slice(0, 4),
    [data.products, product],
  );
  const gallery = useMemo(() => product ? normalizeProductImages(product) : [], [product]);

  if (!product) {
    return <section className="page-state container"><span className="section-kicker">PRODUTO</span><h1>Produto não encontrado.</h1><p>Ele pode ter sido ocultado ou removido do catálogo.</p><Link className="button button-primary" href={storeHref("/#catalogo")}>Voltar ao catálogo</Link></section>;
  }

  const stock = stockLabel(product);
  const favorite = favorites.includes(product.id);
  const orderable = isProductPubliclySellable(product);
  const visibleImage = selectedImage && gallery.includes(selectedImage) ? selectedImage : product.imageUrl || gallery[0] || "";

  return (
    <>
      <section className="product-page container">
        <Link className="back-link" href={storeHref("/#catalogo")}><ChevronLeft /> Voltar ao catálogo</Link>
        <div className="product-detail-grid">
          <div className="product-detail-gallery" style={{ "--product-accent": product.accent } as React.CSSProperties}>
            {gallery.length > 1 && <div className="product-detail-thumbnails" aria-label="Fotos do produto">{gallery.map((image, index) => <button className={image === visibleImage ? "active" : ""} type="button" onClick={() => setSelectedImage(image)} key={image} aria-label={`Ver foto ${index + 1}`} aria-pressed={image === visibleImage}><img src={image} alt="" /></button>)}</div>}
            <div className="product-detail-visual">{visibleImage ? <img className="product-detail-main-image" src={visibleImage} alt={product.name} /> : <ProductArt product={product} large />}</div>
          </div>
          <div className="product-detail-copy">
            <span className="section-kicker">{product.category} · {product.brand}</span>
            <div className="product-title-row"><h1>{product.name}</h1><button className={`favorite-button detail-favorite ${favorite ? "active" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label="Alternar favorito"><Heart fill={favorite ? "currentColor" : "none"} /></button></div>
            <div className="rating">★★★★★ <span>{product.rating} · {product.reviews} avaliações</span></div>
            <p className="product-long-description">{product.description}</p>
            <div className="detail-price price-stack">{product.compareAt > product.price && <del>{formatMoney(product.compareAt)}</del>}<strong>{formatMoney(product.price)}</strong><small>{data.settings.pixDiscount}% OFF no Pix</small></div>
            <dl className="product-facts"><div><dt>SKU</dt><dd>{product.sku}</dd></div><div><dt>Disponibilidade</dt><dd className={`stock-${stock.tone}`}>{stock.label}</dd></div><div><dt>Pedido</dt><dd>{orderable ? "Disponível" : "Aguardando validação"}</dd></div><div><dt>Entrega</dt><dd>{data.settings.freeShippingEnabled ? `Frete grátis acima de ${formatMoney(data.settings.freeShippingThreshold)}` : `Frete fixo de ${formatMoney(data.settings.shippingFlat)}`}</dd></div></dl>
            {orderable ? <div className="quantity-buy">
                <div className="quantity-picker"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuir quantidade"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} aria-label="Aumentar quantidade"><Plus /></button></div>
                <button className="button button-primary button-large" disabled={product.stock <= 0} onClick={() => { addItem(product.id, quantity); toast(`${product.name} adicionado ao carrinho.`); setDrawerOpen(true); }}>Adicionar ao carrinho</button>
              </div>
              : <div className="catalog-validation-notice"><div><strong>Produto visível para consulta</strong><p>A liberação para pedido depende da validação das informações no painel.</p></div><a className="button button-primary" href={whatsappUrl(data.settings.whatsapp, `Olá! Gostaria de consultar a disponibilidade de ${product.name}.`)} target="_blank" rel="noreferrer"><MessageCircle /> Consultar no WhatsApp</a></div>}
            <div className="detail-assurances"><span><ShieldCheck /> {data.settings.checkoutMode === "whatsapp" ? "Pedido enviado direto para a loja" : "Pedido 100% demonstrativo"}</span><span><Truck /> Frete confirmado no atendimento</span></div>
          </div>
        </div>
      </section>
      {related.length > 0 && <section className="section related-section"><div className="container"><h2>Produtos relacionados.</h2><div className="product-grid">{related.map((item) => <ProductCard product={item} key={item.id} />)}</div></div></section>}
    </>
  );
}
