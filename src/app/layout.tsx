import type { Metadata } from "next";
import Script from "next/script";
import { AppProviders } from "@/components/providers/app-providers";
import { getStoreData } from "@/lib/store-data";
import { platformConfig } from "@/config/platform";
import {
  buildPrivateCatalogSocialMetadata,
  privateCatalogRobots,
} from "@/lib/storefront-metadata";
import "react-circular-progressbar/dist/styles.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const data = await getStoreData();
  const title = `${data.settings.storeName} | Catálogo privado`;
  const description = data.settings.footerDescription || platformConfig.metadataDescription;

  return {
    metadataBase: new URL(platformConfig.siteUrl),
    title: {
      default: title,
      template: `%s | ${data.settings.storeName}`,
    },
    description,
    icons: { icon: data.settings.faviconUrl || platformConfig.defaultFaviconUrl },
    robots: privateCatalogRobots,
    ...buildPrivateCatalogSocialMetadata({
      title,
      description,
      storeName: data.settings.storeName,
      imageUrl: data.settings.logoUrl || platformConfig.socialImageUrl,
    }),
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const data = await getStoreData();
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <Script id="admin-theme-bootstrap" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("junior-imports:admin-theme");if(t!=="dark"&&t!=="light"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.adminTheme=t}catch(e){}})();`}
        </Script>
      </head>
      <body>
        <AppProviders initialData={data}>{children}</AppProviders>
      </body>
    </html>
  );
}
