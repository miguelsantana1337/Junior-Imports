import type { StorefrontProduct } from "@/types/store";
import { getProductImageFramingStyle } from "@/lib/product-image-framing";

export function ProductArt({ product, large = false }: { product: StorefrontProduct; large?: boolean }) {
  if (product.imageUrl) {
    const framingStyle = getProductImageFramingStyle(product.imageUrl);
    return (
      // User-managed URLs come from Supabase Storage or the demo form.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="product-image product-image-framed" style={framingStyle} src={product.imageUrl} alt={product.name} />
    );
  }

  return (
    <div
      className={`product-art ${large ? "product-art-large" : ""}`}
      style={{ "--product-accent": product.accent } as React.CSSProperties}
      aria-label={`Ilustração de ${product.name}`}
    >
      <div className="product-art-box">
        <small>{product.brand || "LOJA ONLINE"}</small>
        <b>{product.name}</b>
        <i />
      </div>
      <div className="product-art-vial">{product.category}</div>
    </div>
  );
}
