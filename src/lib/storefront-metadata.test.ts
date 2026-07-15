import { describe, expect, it } from "vitest";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "./storefront-metadata";

describe("metadados do catálogo privado", () => {
  it("desativa indexação e acompanhamento de links", () => {
    expect(privateCatalogRobots).toMatchObject({
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    });
  });

  it("mantém título, descrição e imagem para compartilhamento", () => {
    const metadata = buildPrivateCatalogSocialMetadata({
      title: "Produto | Loja",
      description: "Descrição do produto",
      storeName: "Loja",
      imageUrl: "https://cdn.example.com/produto.jpg",
    });

    expect(metadata.openGraph).toMatchObject({
      title: "Produto | Loja",
      description: "Descrição do produto",
      siteName: "Loja",
      images: [
        {
          url: "https://cdn.example.com/produto.jpg",
          alt: "Catálogo privado da Loja",
        },
      ],
    });
    expect(metadata.twitter).toMatchObject({
      card: "summary_large_image",
      images: ["https://cdn.example.com/produto.jpg"],
    });
  });
});
