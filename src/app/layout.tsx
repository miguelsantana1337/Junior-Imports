import type { Metadata } from "next";
import { AppProviders } from "@/components/providers/app-providers";
import { getStoreData } from "@/lib/store-data";
import "react-circular-progressbar/dist/styles.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getStoreData();
  return {
    title: {
      default: `${data.settings.storeName} | E-commerce demonstrativo`,
      template: `%s | ${data.settings.storeName}`,
    },
    description: "Aplicação demonstrativa de e-commerce com catálogo, carrinho, checkout e painel administrativo.",
    icons: { icon: data.settings.faviconUrl || "/favicon.svg" },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await getStoreData();
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <AppProviders initialData={data}>{children}</AppProviders>
      </body>
    </html>
  );
}
