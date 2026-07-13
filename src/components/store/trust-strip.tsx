"use client";

import { BadgeCheck, Headphones, ShieldCheck, Truck } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";

const icons = [BadgeCheck, ShieldCheck, Truck, Headphones];

export function TrustStrip() {
  const { data } = useStore();
  return (
    <section className="trust-strip" aria-label="Beneficios da loja">
      <div className="container trust-grid">
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
