"use client";

import { Eye, Heart, Plus } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/providers/cart-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useStore } from "@/components/providers/store-provider";
import { ProductArt } from "@/components/ui/product-art";
import { discountPercent, stockLabel } from "@/lib/commerce";
import { formatMoney } from "@/lib/format";
import { canAddProductToCart, isProductPubliclySellable } from "@/lib/product-compliance";
import { withStorefrontPath } from "@/lib/storefront-path";
import type { StorefrontProduct } from "@/types/store";

export function ProductCard({ product }: { product: StorefrontProduct }) {
  const { favorites, toggleFavorite, addItem, setDrawerOpen, ready: cartReady } = useCart();
  const { data } = useStore();
  const toast = useToast();
  const stock = stockLabel(product);
  const discount = discountPercent(product);
  const favorite = favorites.includes(product.id);
  const orderable = isProductPubliclySellable(product);
  const cartEligible = canAddProductToCart(product, data.settings.checkoutMode);
  const detailHref = withStorefrontPath(data.tenant.storefrontPath, `/produtos/${product.slug}`);

  return (
    <article className="product-card" data-testid={`product-${product.slug}`}>
      <div className="product-card-visual">
        {(product.badge || discount > 0) && <span className="product-badge">{product.badge || `-${discount}%`}</span>}
        <button
          className={`favorite-button ${favorite ? "active" : ""}`}
          onClick={() => toggleFavorite(product.id)}
          aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
        ><Heart fill={favorite ? "currentColor" : "none"} /></button>
        <Link href={detailHref} aria-label={`Ver detalhes de ${product.name}`}><ProductArt product={product} /></Link>
        <Link className="quick-link" href={detailHref}>Ver detalhes</Link>
      </div>
      <div className="product-card-body">
        <div className="product-meta"><span>{product.category}</span><small className={`stock-${stock.tone}`}>{stock.label}</small></div>
        <Link href={detailHref}><h3>{product.name}</h3></Link>
        <p>{product.description}</p>
        <div className="rating" aria-label={`${product.rating} de 5 estrelas`}>★★★★★ <span>{product.rating} ({product.reviews})</span></div>
        <div className="product-bottom">
          <div className="price-stack">
            {product.compareAt > product.price && <del>{formatMoney(product.compareAt)}</del>}
            <strong>{formatMoney(product.price)}</strong>
            <small>{orderable ? `${data.settings.pixDiscount}% OFF no Pix` : cartEligible ? "Confirmação pelo WhatsApp" : "Consulte a disponibilidade"}</small>
          </div>
          {cartEligible ? <button
              className="add-button"
              disabled={!cartReady || product.stock <= 0}
              onClick={() => {
                addItem(product.id);
                toast(`${product.name} adicionado ao carrinho.`);
                setDrawerOpen(true);
              }}
              aria-label={`Adicionar ${product.name} ao carrinho`}
            ><Plus /></button>
            : <Link className="add-button consult-button" href={detailHref} aria-label={`Consultar disponibilidade de ${product.name}`}><Eye /></Link>}
        </div>
      </div>
    </article>
  );
}
