"use client";

import { BadgeCheck, Headphones, ShieldCheck, Truck } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import type { PageBlock } from "@/types/store";

const icons = [BadgeCheck, ShieldCheck, Truck, Headphones];

export function TrustStrip({ block }: { block: PageBlock }) {
  const { data } = useStore();
  return (
    <section className={`trust-strip page-block-shell padding-${block.padding}`} aria-label="Beneficios da loja" style={{ backgroundColor: block.backgroundColor || undefined, color: block.textColor || undefined }}>
      <div className={`page-block-container width-${block.containerWidth} trust-grid`} style={{ "--trust-columns": block.columns } as React.CSSProperties}>
        {[...data.trustItems].sort((a, b) => a.order - b.order).map((item, index) => {
          const Icon = icons[index % icons.length];
          return (
            <article className="trust-item" key={item.id}>
              <span><Icon /></span>
              <div><strong>{item.title}</strong><small>{item.subtitle}</small></div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
