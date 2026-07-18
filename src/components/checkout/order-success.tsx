"use client";

import { Check, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { formatMoney, whatsappUrl } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function OrderSuccess({ code }: { code: string }) {
  const { data } = useStore();
  const homeHref = withStorefrontPath(data.tenant.storefrontPath, "/");
  const order = data.orders.find((item) => item.code === code);
  if (!order) return <section className="page-state container"><h1>Pedido não encontrado.</h1><p>Pedidos do modo local ficam salvos apenas neste navegador.</p><Link className="button button-primary" href={homeHref}>Voltar para a loja</Link></section>;
  const whatsappMode = data.settings.checkoutMode === "whatsapp";
  return <section className="success-page container"><div className="success-icon"><Check /></div><span className="section-kicker">PEDIDO REGISTRADO</span><h1>{whatsappMode ? "Pedido pronto para atendimento." : "Pedido demonstrativo criado."}</h1><p>{whatsappMode ? "Envie o código para a loja confirmar disponibilidade, valor final e entrega." : "Nenhuma cobrança, separação ou entrega foi iniciada."}</p><div className="order-code">{order.code}</div><div className="success-total"><span>{whatsappMode ? "Total estimado" : "Total demonstrativo"}</span><strong>{formatMoney(order.total)}</strong>{order.cashbackTotal > 0 && <em>Cashback previsto: {formatMoney(order.cashbackTotal)}</em>}</div><div className="success-actions"><a className="button button-primary button-large" href={whatsappUrl(data.settings.whatsapp, `Olá! Quero confirmar o pedido ${order.code} no valor estimado de ${formatMoney(order.total)}.`)} target="_blank" rel="noreferrer"><MessageCircle /> Enviar código pelo WhatsApp</a><Link className="button button-ghost button-large" href={homeHref}>Continuar comprando</Link></div></section>;
}
