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
}

export function buildPrivateCatalogSocialMetadata({
  title,
  description,
  storeName,
  imageUrl,
}: SocialMetadataInput): Pick<Metadata, "openGraph" | "twitter"> {
  const image = imageUrl || platformConfig.socialImageUrl;

  return {
    openGraph: {
      type: "website",
      locale: "pt_BR",
      title,
      description,
      siteName: storeName,
      images: [{ url: image, alt: `Catálogo privado da ${storeName}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}
