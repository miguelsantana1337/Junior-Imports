"use client";

import { Heart, Plus } from "lucide-react";
import Link from "next/link";
import { useCart } from "@/components/providers/cart-provider";
import { useToast } from "@/components/providers/toast-provider";
import { useStore } from "@/components/providers/store-provider";
import { ProductArt } from "@/components/ui/product-art";
import { discountPercent, stockLabel } from "@/lib/commerce";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";
import type { Product } from "@/types/store";

export function ProductCard({ product }: { product: Product }) {
  const { favorites, toggleFavorite, addItem, setDrawerOpen } = useCart();
  const { data } = useStore();
  const toast = useToast();
  const stock = stockLabel(product);
  const discount = discountPercent(product);
  const favorite = favorites.includes(product.id);

  return (
    <article className="product-card" data-testid={`product-${product.slug}`}>
      <div className="product-card-visual">
        {(product.badge || discount > 0) && <span className="product-badge">{product.badge || `-${discount}%`}</span>}
        <button
          className={`favorite-button ${favorite ? "active" : ""}`}
          onClick={() => toggleFavorite(product.id)}
          aria-label={favorite ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
        ><Heart fill={favorite ? "currentColor" : "none"} /></button>
        <Link href={withStorefrontPath(data.tenant.storefrontPath, `/produtos/${product.slug}`)} aria-label={`Ver detalhes de ${product.name}`}><ProductArt product={product} /></Link>
        <Link className="quick-link" href={withStorefrontPath(data.tenant.storefrontPath, `/produtos/${product.slug}`)}>Ver detalhes</Link>
      </div>
      <div className="product-card-body">
        <div className="product-meta"><span>{product.category}</span><small className={`stock-${stock.tone}`}>{stock.label}</small></div>
        <Link href={withStorefrontPath(data.tenant.storefrontPath, `/produtos/${product.slug}`)}><h3>{product.name}</h3></Link>
        <p>{product.description}</p>
        <div className="rating" aria-label={`${product.rating} de 5 estrelas`}>★★★★★ <span>{product.rating} ({product.reviews})</span></div>
        <div className="product-bottom">
          <div className="price-stack">
            {product.compareAt > product.price && <del>{formatMoney(product.compareAt)}</del>}
            <strong>{formatMoney(product.price)}</strong>
            <small>5% OFF no Pix</small>
          </div>
          <button
            className="add-button"
            disabled={product.stock <= 0}
            onClick={() => {
              addItem(product.id);
              toast(`${product.name} adicionado ao carrinho.`);
              setDrawerOpen(true);
            }}
            aria-label={`Adicionar ${product.name} ao carrinho`}
          ><Plus /></button>
        </div>
      </div>
    </article>
  );
}
