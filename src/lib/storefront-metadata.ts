import type { Metadata } from "next";
import { platformConfig } from "@/config/platform";

export const privateCatalogRobots: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

interface SocialMetadataInput {
  title: string;
  description: string;
  storeName: string;
  imageUrl?: string;
  imageAlt?: string;
  url?: string;
}

export function buildStorefrontSocialMetadata({
  title,
  description,
  storeName,
  imageUrl,
  imageAlt,
  url,
}: SocialMetadataInput): Pick<Metadata, "openGraph" | "twitter"> {
  const image = imageUrl || platformConfig.socialImageUrl;

  return {
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title,
      description,
      siteName: storeName,
      ...(url ? { url } : {}),
      images: [{ url: image, alt: imageAlt || storeName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export function buildPrivateCatalogSocialMetadata(input: SocialMetadataInput) {
  return buildStorefrontSocialMetadata({
    ...input,
    imageAlt: input.imageAlt || `Catálogo privado da ${input.storeName}`,
  });
}
