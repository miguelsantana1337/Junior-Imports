"use client";

import Image, { type ImageLoaderProps } from "next/image";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";

const passthroughLoader = ({ src }: ImageLoaderProps) => src;

export function Logo({ compact = false }: { compact?: boolean }) {
  const { data } = useStore();
  const customLogo = Boolean(data.settings.logoUrl);
  const [firstName, ...rest] = data.settings.storeName.trim().split(/\s+/);
  return (
    <Link className={`brand ${customLogo ? "has-custom-logo" : ""}`} href="/" aria-label={`${data.settings.storeName} - início`}>
      <Image className="brand-image" loader={passthroughLoader} unoptimized src={data.settings.logoUrl || "/admin-brand.png"} width={customLogo ? 160 : 38} height={customLogo ? 48 : 38} alt={customLogo ? data.settings.storeName : ""} priority />
      {!compact && !customLogo && <span className="brand-text"><strong>{firstName || "JUNIOR"}</strong><small>{rest.join(" ") || "IMPORTS"}</small></span>}
    </Link>
  );
}
