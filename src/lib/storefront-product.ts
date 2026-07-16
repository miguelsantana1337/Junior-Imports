import type { Product, StorefrontProduct } from "@/types/store";

export function sanitizeProductForStorefront(
  product: Product | StorefrontProduct,
  purchaseLimit = product.stock,
  bucketStock = true,
): StorefrontProduct {
  const publicPurchaseLimit = !bucketStock
    ? Math.min(10, Math.max(0, purchaseLimit))
    : purchaseLimit <= 0
    ? 0
    : purchaseLimit <= 5
      ? 1
      : purchaseLimit <= 10
        ? 5
        : 10;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    categoryId: product.categoryId,
    category: product.category,
    brand: product.brand,
    price: product.price,
    compareAt: product.compareAt,
    stock: publicPurchaseLimit,
    badge: product.badge,
    accent: product.accent,
    description: product.description,
    rating: product.rating,
    reviews: product.reviews,
    featured: product.featured,
    active: product.active,
    order: product.order,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    productType: product.productType,
    regulatoryStatus: product.regulatoryStatus,
    activeIngredient: product.activeIngredient,
    anvisaRegistration: product.anvisaRegistration,
    presentation: product.presentation,
    regulatoryWarning: product.regulatoryWarning,
    pharmacistReviewed: product.pharmacistReviewed,
  };
}
