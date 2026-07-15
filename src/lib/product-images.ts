import type { Product } from "@/types/store";

type ProductImages = Pick<Product, "imageUrl" | "imageUrls">;

export function normalizeProductImages(product: Partial<ProductImages>): string[] {
  const images = Array.isArray(product.imageUrls) ? product.imageUrls : [];
  return [...new Set([...images, product.imageUrl ?? ""].map((image) => image.trim()).filter(Boolean))];
}

export function setProductCover(product: ProductImages, imageUrl: string): ProductImages {
  const images = normalizeProductImages(product);
  if (!images.includes(imageUrl)) return { imageUrl: product.imageUrl, imageUrls: images };
  return { imageUrl, imageUrls: images };
}

export function reorderProductImages(product: ProductImages, fromIndex: number, toIndex: number): ProductImages {
  const images = normalizeProductImages(product);
  if (fromIndex < 0 || fromIndex >= images.length || toIndex < 0 || toIndex >= images.length || fromIndex === toIndex) {
    return { imageUrl: product.imageUrl, imageUrls: images };
  }
  const reordered = [...images];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  return { imageUrl: product.imageUrl, imageUrls: reordered };
}

export function removeProductImage(product: ProductImages, imageUrl: string): ProductImages {
  const imageUrls = normalizeProductImages(product).filter((image) => image !== imageUrl);
  return {
    imageUrls,
    imageUrl: product.imageUrl === imageUrl ? imageUrls[0] ?? "" : product.imageUrl,
  };
}
