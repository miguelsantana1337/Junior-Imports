"use client";
/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, Heart, MessageCircle, Minus, Plus, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ProductArt } from "@/components/ui/product-art";
import { stockLabel } from "@/lib/commerce";
import { storefrontCashbackOffer } from "@/lib/cashback";
import { formatMoney, whatsappUrl } from "@/lib/format";
import { isPixDiscountEligible, isStorePromotionRuleActive } from "@/lib/store-promotion";
import { canAddProductToCart, isProductPubliclySellable } from "@/lib/product-compliance";
import { normalizeProductImages } from "@/lib/product-images";
import { getProductImageFramingStyle } from "@/lib/product-image-framing";
import { withStorefrontPath } from "@/lib/storefront-path";
import { groupElectronicsProductModels, type ElectronicsProductModel } from "@/lib/electronics-product-variants";
import { ProductCard } from "./product-card";
import { ProductStorageSelector } from "./product-storage-selector";

export function ProductDetail({ slug }: { slug: string }) {
  // Next can reuse this component when following a capacity link. Remount the
  // selection state so quantity and gallery never leak into another SKU.
  return <ProductDetailVariant slug={slug} key={slug} />;
}

function ProductDetailVariant({ slug }: { slug: string }) {
  const { data, storefrontScope } = useStore();
  const { addItem, favorites, toggleFavorite, setDrawerOpen, ready: cartReady, trackEvent } = useCart();
  const toast = useToast();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState("");
  const [selectedComponents, setSelectedComponents] = useState<string[]>([]);
  const product = data.products.find((item) => item.slug === slug && item.active);
  const bundle = data.bundles.find((item) => item.productId === product?.id);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const models = useMemo<ElectronicsProductModel[]>(() => storefrontScope === "electronics"
    ? groupElectronicsProductModels(data.products)
    : data.products.filter((item) => item.active).map((product) => ({ product })), [data.products, storefrontScope]);
  const currentModel = models.find((model) => model.product.id === product?.id || model.selection?.options.some((option) => option.product.id === product?.id));
  const selection = currentModel?.selection;
  const related = models.filter((model) => model !== currentModel && model.product.categoryId === product?.categoryId).slice(0, 4);
  const gallery = useMemo(() => product ? normalizeProductImages(product) : [], [product]);
  const bundleOptions = useMemo(() => bundle
    ? bundle.options.map((option) => ({ ...option, product: data.products.find((item) => item.id === option.productId) })).filter((option) => option.product?.active)
    : [], [bundle, data.products]);

  useEffect(() => {
    if (product) trackEvent("product_viewed", `product_viewed:${product.id}`, {}, product.id);
  }, [product, trackEvent]);

  if (!product) {
    return <section className="page-state container"><span className="section-kicker">PRODUTO</span><h1>Produto não encontrado.</h1><p>Ele pode ter sido ocultado ou removido do catálogo.</p><Link className="button button-primary" href={storeHref("/#catalogo")}>Voltar ao catálogo</Link></section>;
  }

  const stock = stockLabel(product);
  const favorite = favorites.includes(product.id);
  const orderable = isProductPubliclySellable(product);
  const cartEligible = canAddProductToCart(product, data.settings.checkoutMode);
  const cashbackOffer = storefrontCashbackOffer(product, data.cashbackCampaigns);
  const visibleImage = selectedImage && gallery.includes(selectedImage) ? selectedImage : product.imageUrl || gallery[0] || "";
  const addToCart = () => {
    if (bundle && selectedComponents.length !== bundle.componentCount) {
      toast(`Escolha exatamente ${bundle.componentCount} componentes para montar o kit.`);
      return;
    }
    addItem(product.id, quantity, selectedComponents);
    toast(`${product.name} adicionado ao carrinho.`);
    setDrawerOpen(true);
  };
  const adjustComponent = (productId: string, direction: -1 | 1) => {
    if (!bundle) return;
    setSelectedComponents((current) => {
      const currentCount = current.filter((id) => id === productId).length;
      if (direction < 0) {
        const index = current.lastIndexOf(productId);
        return index < 0 ? current : current.filter((_, itemIndex) => itemIndex !== index);
      }
      const option = bundle.options.find((item) => item.productId === productId);
      const optionProduct = data.products.find((item) => item.id === productId);
      const limit = Math.min(bundle.maxPerComponent, option?.maxQuantity ?? 1, optionProduct?.stock ?? 0);
      if (current.length >= bundle.componentCount || currentCount >= limit || (!bundle.allowRepetition && currentCount > 0)) return current;
      return [...current, productId];
    });
  };

  return (
    <>
      <section className="product-page container">
        <Link className="back-link" href={storeHref("/#catalogo")}><ChevronLeft /> Voltar ao catálogo</Link>
        <div className="product-detail-grid">
          <div className="product-detail-gallery" style={{ "--product-accent": product.accent } as React.CSSProperties}>
            {gallery.length > 1 && <div className="product-detail-thumbnails" aria-label="Fotos do produto">{gallery.map((image, index) => { const framingStyle = getProductImageFramingStyle(image); return <button className={image === visibleImage ? "active" : ""} type="button" onClick={() => setSelectedImage(image)} key={image} aria-label={`Ver foto ${index + 1}`} aria-pressed={image === visibleImage}><img className="product-image-framed" style={framingStyle} src={image} alt="" /></button>; })}</div>}
            <div className="product-detail-visual">{visibleImage ? <img className="product-detail-main-image product-image-framed" style={getProductImageFramingStyle(visibleImage)} src={visibleImage} alt={product.name} /> : <ProductArt product={product} large />}</div>
          </div>
          <div className="product-detail-copy">
            <span className="section-kicker">{product.category} · {product.brand}</span>
            <div className="product-title-row"><h1>{selection?.name ?? product.name}</h1><button className={`favorite-button detail-favorite ${favorite ? "active" : ""}`} onClick={() => toggleFavorite(product.id)} aria-label="Alternar favorito"><Heart fill={favorite ? "currentColor" : "none"} /></button></div>
            <p className="product-long-description">{product.description}</p>
            {selection && <ProductStorageSelector selection={selection} productId={product.id} storefrontPath={data.tenant.storefrontPath} />}
            <div className="detail-price price-stack">{product.compareAt > product.price && <del>{formatMoney(product.compareAt)}</del>}<strong>{formatMoney(product.price)}</strong>{product.currencyPricingEnabled && <small>Preço atualizado conforme o dólar</small>}{isPixDiscountEligible(data.settings, product.price) && <small>{data.settings.pixDiscount}% OFF no Pix</small>}</div>
            {(cashbackOffer.value > 0 || cashbackOffer.fixedBonus > 0) && <div className="product-detail-cashback"><strong>{cashbackOffer.type === "percent" ? `Ganhe ${cashbackOffer.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de cashback${cashbackOffer.fixedBonus > 0 ? ` + ${formatMoney(cashbackOffer.fixedBonus)}` : ""}` : `Ganhe até ${formatMoney(cashbackOffer.value * quantity)} de cashback`}</strong><span>Calculado sobre o valor pago pelos produtos, após descontos e sem frete · liberado após a confirmação</span></div>}
            {bundle && <section className="bundle-selector" aria-labelledby="bundle-selector-title"><header><div><span>KIT CONFIGURÁVEL</span><h2 id="bundle-selector-title">{bundle.selectionLabel}</h2></div><strong>{selectedComponents.length}/{bundle.componentCount}</strong></header><p>Monte a composição antes de adicionar ao carrinho. O estoque de cada opção é conferido novamente ao finalizar.</p><div className="bundle-option-grid">{bundleOptions.map((option) => { const selected = selectedComponents.filter((id) => id === option.productId).length; const unavailable = !option.product || option.product.stock <= 0; return <article className={selected ? "selected" : ""} key={option.productId}><ProductArt product={option.product!} /><div><strong>{option.product!.name}</strong><small>{unavailable ? "Esgotado" : `${option.product!.stock} disponível${option.product!.stock === 1 ? "" : "is"}`}</small></div><div><button type="button" onClick={() => adjustComponent(option.productId, -1)} disabled={!selected} aria-label={`Remover ${option.product!.name}`}><Minus /></button><b>{selected}</b><button type="button" onClick={() => adjustComponent(option.productId, 1)} disabled={unavailable || selectedComponents.length >= bundle.componentCount || (!bundle.allowRepetition && selected > 0)} aria-label={`Adicionar ${option.product!.name}`}><Plus /></button></div></article>; })}</div><footer className={selectedComponents.length === bundle.componentCount ? "complete" : ""}>{selectedComponents.length === bundle.componentCount ? <><ShieldCheck /> Kit completo e pronto para o carrinho.</> : `Faltam ${bundle.componentCount - selectedComponents.length} escolha${bundle.componentCount - selectedComponents.length === 1 ? "" : "s"}.`}</footer></section>}
            <dl className="product-facts"><div><dt>Marca</dt><dd>{product.brand || data.settings.storeName}</dd></div><div><dt>Disponibilidade</dt><dd className={`stock-${stock.tone}`}>{stock.label}</dd></div><div><dt>Pedido</dt><dd>{product.madeToOrder ? "Prazo confirmado no WhatsApp" : cartEligible ? "Disponível para pedido" : product.stock <= 0 ? "Indisponível" : "Fale com a equipe"}</dd></div><div><dt>Entrega</dt><dd>{data.settings.shippingCityRates.length ? "Frete calculado pela cidade do CEP" : data.settings.freeShippingEnabled && isStorePromotionRuleActive(data.settings) ? `Frete grátis acima de ${formatMoney(data.settings.freeShippingThreshold)}` : `Frete fixo de ${formatMoney(data.settings.shippingFlat)}`}</dd></div></dl>
            {cartEligible ? <div className="product-order-stack">
              {!orderable && <div className="catalog-validation-notice compact"><ShieldCheck /><div><strong>Compra com confirmação no WhatsApp</strong><p>Adicione ao carrinho normalmente. A equipe confirma as condições e acompanha o pedido pelo atendimento.</p></div></div>}
              <div className="quantity-buy">
                <div className="quantity-picker"><button onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Diminuir quantidade"><Minus /></button><span>{quantity}</span><button onClick={() => setQuantity((value) => Math.min(product.stock, value + 1))} aria-label="Aumentar quantidade"><Plus /></button></div>
                <button className="button button-primary button-large" disabled={!cartReady || Boolean(bundle && selectedComponents.length !== bundle.componentCount)} onClick={addToCart}><ShoppingCart /> {cartReady ? bundle && selectedComponents.length !== bundle.componentCount ? "Complete o kit" : "Adicionar ao carrinho" : "Preparando carrinho..."}</button>
              </div></div>
              : <div className="catalog-validation-notice"><div><strong>{product.stock <= 0 ? "Produto esgotado" : "Produto visível para consulta"}</strong><p>{product.stock <= 0 ? "Consulte a loja para saber quando haverá reposição." : "A liberação para pedido depende da validação das informações no painel."}</p></div><a className="button button-primary" href={whatsappUrl(data.settings.whatsapp, `Olá! Gostaria de consultar a disponibilidade de ${product.name}.`)} target="_blank" rel="noreferrer"><MessageCircle /> Consultar no WhatsApp</a></div>}
            <div className="detail-assurances"><span><ShieldCheck /> Pedido registrado direto com a loja</span><span><Truck /> Envio acompanhado no atendimento</span></div>
          </div>
        </div>
      </section>
      {cartEligible && <div className="product-mobile-purchase" aria-label="Compra rápida"><div><small>{bundle ? `${selectedComponents.length}/${bundle.componentCount} escolhas` : `${quantity} ${quantity === 1 ? "unidade" : "unidades"}`}{cashbackOffer.value > 0 ? cashbackOffer.type === "percent" ? ` · ${cashbackOffer.value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% cashback` : ` · até ${formatMoney(cashbackOffer.value * quantity)} cashback` : ""}</small><strong>{formatMoney(product.price * quantity)}</strong></div><button className="button button-primary" disabled={!cartReady || Boolean(bundle && selectedComponents.length !== bundle.componentCount)} onClick={addToCart} aria-label={`Compra rápida: adicionar ${product.name}`}><ShoppingCart /> {bundle && selectedComponents.length !== bundle.componentCount ? "Escolha" : "Adicionar"}</button></div>}
      {related.length > 0 && <section className="section related-section"><div className="container"><h2>Produtos relacionados.</h2><div className="product-grid">{related.map(({ product, selection }) => <ProductCard product={product} selection={selection} key={product.id} />)}</div></div></section>}
    </>
  );
}
