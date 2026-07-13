"use client";

import { Check, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useStore } from "@/components/providers/store-provider";
import { formatMoney, whatsappUrl } from "@/lib/format";

export function OrderSuccess({ code }: { code: string }) {
  const { data } = useStore();
  const order = data.orders.find((item) => item.code === code);
  if (!order) return <section className="page-state container"><h1>Pedido não encontrado.</h1><p>Pedidos do modo local ficam salvos apenas neste navegador.</p><Link className="button button-primary" href="/">Voltar para a loja</Link></section>;
  return <section className="success-page container"><div className="success-icon"><Check /></div><span className="section-kicker">PEDIDO REGISTRADO</span><h1>Pedido demonstrativo criado.</h1><p>Nenhuma cobrança, separação ou entrega foi iniciada.</p><div className="order-code">{order.code}</div><div className="success-total"><span>Total demonstrativo</span><strong>{formatMoney(order.total)}</strong></div><div className="success-actions"><a className="button button-primary button-large" href={whatsappUrl(data.settings.whatsapp, `Olá! Criei o pedido demonstrativo ${order.code} no valor de ${formatMoney(order.total)}.`)} target="_blank" rel="noreferrer"><MessageCircle /> Enviar código pelo WhatsApp</a><Link className="button button-ghost button-large" href="/">Continuar comprando</Link></div></section>;
}
