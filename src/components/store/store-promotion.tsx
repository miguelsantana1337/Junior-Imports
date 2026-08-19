"use client";

import { BadgePercent, Coins, CreditCard, Gift, Handshake, TicketPercent, Truck } from "lucide-react";
import { useStore } from "@/components/providers/store-provider";
import { isStorePromotionActive } from "@/lib/store-promotion";

const benefitIcons = [Coins, Truck, BadgePercent, Gift, TicketPercent, Handshake, CreditCard];

export function StorePromotion({ compact = false }: { compact?: boolean }) {
  const { data } = useStore();
  const settings = data.settings;
  if (!isStorePromotionActive(settings) || !settings.promotionHighlights.length) return null;

  return (
    <section className={`store-promotion ${compact ? "compact" : ""}`} aria-label={settings.promotionName}>
      <div className={compact ? undefined : "container"}>
        <header>
          <span>CONDIÇÕES DA SEMANA</span>
          <h2>{settings.promotionName}</h2>
          {!compact && <p>Benefícios aplicados automaticamente quando o pedido atende às condições.</p>}
        </header>
        <div className="store-promotion-grid">
          {settings.promotionHighlights.map((highlight, index) => {
            const Icon = benefitIcons[index % benefitIcons.length];
            return <article key={`${index}-${highlight}`}><Icon /><strong>{highlight}</strong></article>;
          })}
        </div>
        {settings.promotionGiftMessage && <footer><Gift /><span>{settings.promotionGiftMessage}</span></footer>}
      </div>
    </section>
  );
}
