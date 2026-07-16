import type { StorefrontProduct } from "@/types/store";

export function ProductArt({ product, large = false }: { product: StorefrontProduct; large?: boolean }) {
  if (product.imageUrl) {
    return (
      // User-managed URLs come from Supabase Storage or the demo form.
      // eslint-disable-next-line @next/next/no-img-element
      <img className="product-image" src={product.imageUrl} alt={product.name} />
    );
  }

  return (
    <div
      className={`product-art ${large ? "product-art-large" : ""}`}
      style={{ "--product-accent": product.accent } as React.CSSProperties}
      aria-label={`Ilustracao demonstrativa de ${product.name}`}
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
