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
  return <section className="success-page container"><div className="success-icon"><Check /></div><span className="section-kicker">PEDIDO REGISTRADO</span><h1>Seu pedido foi recebido.</h1><p>Envie o código para a loja confirmar pagamento, disponibilidade e envio pelo atendimento oficial.</p><div className="order-code">{order.code}</div><div className="success-total"><span>Total do pedido</span><strong>{formatMoney(order.total)}</strong>{order.cashbackTotal > 0 && <em>Cashback previsto: {formatMoney(order.cashbackTotal)}</em>}</div><div className="success-actions"><a className="button button-primary button-large" href={whatsappUrl(data.settings.whatsapp, `Olá! Quero confirmar o pedido ${order.code} no valor de ${formatMoney(order.total)}.`)} target="_blank" rel="noreferrer"><MessageCircle /> Continuar no WhatsApp</a><Link className="button button-ghost button-large" href={homeHref}>Continuar comprando</Link></div></section>;
}
