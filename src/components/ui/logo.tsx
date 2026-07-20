"use client";

import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { platformConfig } from "@/config/platform";
import { withStorefrontPath } from "@/lib/storefront-path";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

export function Logo({ compact = false }: { compact?: boolean }) {
  const { data } = useStore();
  const customLogo = Boolean(data.settings.logoUrl || data.settings.mobileLogoUrl);
  const hasMobileLogo = Boolean(data.settings.mobileLogoUrl);
  const [firstName, ...rest] = data.settings.storeName.trim().split(/\s+/);
  return (
    <Link className={`brand ${customLogo ? "has-custom-logo" : ""} ${hasMobileLogo ? "has-mobile-logo" : ""}`} href={withStorefrontPath(data.tenant.storefrontPath, "/")} aria-label={`${data.settings.storeName} - início`}>
      <Image className="brand-image brand-image-primary" loader={passthroughLoader} unoptimized src={data.settings.logoUrl || platformConfig.defaultLogoUrl} width={customLogo ? 160 : 38} height={customLogo ? 48 : 38} alt={customLogo ? data.settings.storeName : ""} priority />
      {hasMobileLogo && <Image className="brand-image brand-image-mobile" loader={passthroughLoader} unoptimized src={data.settings.mobileLogoUrl} width={150} height={40} alt={data.settings.storeName} priority />}
      {!compact && !customLogo && <span className="brand-text"><strong>{firstName || "LOJA"}</strong><small>{rest.join(" ") || "ONLINE"}</small></span>}
    </Link>
  );
}
