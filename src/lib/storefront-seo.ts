import type { Metadata } from "next";
import { normalizeHostname } from "@/lib/pharmaceutical-storefront-host";
import { groupElectronicsProductModels } from "@/lib/electronics-product-variants";
import { slugify } from "@/lib/format";
import type { StorefrontProduct } from "@/types/store";

export const defaultElectronicsStorefrontUrl = "https://www.juniorimportsoficial.com.br";

export const publicElectronicsRobots: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
};

export function electronicsStorefrontUrl(pathname = "/") {
  const configured = process.env.NEXT_PUBLIC_ELECTRONICS_SITE_URL?.trim()
    || defaultElectronicsStorefrontUrl;
  const base = configured.endsWith("/") ? configured : `${configured}/`;
  return new URL(pathname.replace(/^\//, ""), base).toString();
}

export function isOfficialElectronicsHost(
  hostname: string | null | undefined,
  officialUrl = electronicsStorefrontUrl(),
) {
  return normalizeHostname(hostname) === normalizeHostname(new URL(officialUrl).hostname);
}

export function isIndexableElectronicsPath(pathname: string) {
  return pathname === "/"
    || /^\/produtos\/[^/]+\/?$/.test(pathname);
}

export function storefrontRobotsHeader(hostname: string | null | undefined, pathname: string) {
  return isOfficialElectronicsHost(hostname) && isIndexableElectronicsPath(pathname)
    ? "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    : "noindex, nofollow";
}

function absoluteImageUrl(value: string) {
  if (!value) return "";
  try {
    return new URL(value, electronicsStorefrontUrl()).toString();
  } catch {
    return "";
  }
}

function productOffer(product: StorefrontProduct) {
  return {
    "@type": "Offer",
    url: electronicsStorefrontUrl(`/produtos/${product.slug}`),
    priceCurrency: "BRL",
    price: product.price.toFixed(2),
    availability: product.madeToOrder
      ? "https://schema.org/BackOrder"
      : product.stock > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
  };
}

function productSchema(product: StorefrontProduct, storeName: string, storage?: string) {
  const images = [...new Set(product.imageUrls.map(absoluteImageUrl).filter(Boolean))];
  const description = product.description.trim()
    || `${product.name} disponível na loja de eletrônicos da ${storeName}.`;
  return {
    "@type": "Product",
    name: product.name,
    description,
    url: electronicsStorefrontUrl(`/produtos/${product.slug}`),
    ...(images.length ? { image: images } : {}),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    ...(storage ? {
      size: storage,
      additionalProperty: {
        "@type": "PropertyValue",
        name: "Armazenamento",
        value: storage,
      },
    } : {}),
    category: product.category,
    offers: {
      ...productOffer(product),
      seller: { "@type": "Organization", name: storeName },
    },
  };
}

export function buildElectronicsProductStructuredData(
  selected: StorefrontProduct,
  products: StorefrontProduct[],
  storeName: string,
) {
  const model = groupElectronicsProductModels(products).find((entry) =>
    entry.product.id === selected.id
    || entry.selection?.options.some((option) => option.product.id === selected.id),
  );
  if (!model?.selection) {
    return { "@context": "https://schema.org", ...productSchema(selected, storeName) };
  }

  const images = [...new Set(model.selection.options
    .flatMap((option) => option.product.imageUrls)
    .map(absoluteImageUrl)
    .filter(Boolean))];
  const description = selected.description.trim()
    || `${model.selection.name} com opções de armazenamento na ${storeName}.`;

  return {
    "@context": "https://schema.org",
    "@type": "ProductGroup",
    name: model.selection.name,
    description,
    url: electronicsStorefrontUrl(`/produtos/${model.product.slug}`),
    productGroupID: `${slugify(storeName)}-${slugify(model.selection.name)}`,
    variesBy: "https://schema.org/size",
    ...(images.length ? { image: images } : {}),
    ...(selected.brand ? { brand: { "@type": "Brand", name: selected.brand } } : {}),
    hasVariant: model.selection.options.map((option) =>
      productSchema(option.product, storeName, option.label)),
  };
}

export function buildElectronicsWebsiteStructuredData({
  storeName,
  logoUrl,
  products,
}: {
  storeName: string;
  logoUrl: string;
  products: StorefrontProduct[];
}) {
  const models = groupElectronicsProductModels(products);
  const logo = absoluteImageUrl(logoUrl);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${electronicsStorefrontUrl()}#organization`,
        name: storeName,
        url: electronicsStorefrontUrl(),
        ...(logo ? { logo } : {}),
      },
      {
        "@type": "WebSite",
        "@id": `${electronicsStorefrontUrl()}#website`,
        name: `${storeName} Eletrônicos`,
        url: electronicsStorefrontUrl(),
        publisher: { "@id": `${electronicsStorefrontUrl()}#organization` },
        inLanguage: "pt-BR",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${electronicsStorefrontUrl()}?q={search_term_string}#catalogo`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "ItemList",
        name: "Eletrônicos disponíveis",
        numberOfItems: models.length,
        itemListElement: models.map((model, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: model.selection?.name || model.product.name,
          url: electronicsStorefrontUrl(`/produtos/${model.product.slug}`),
        })),
      },
    ],
  };
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
