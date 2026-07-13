"use client";

import { ChevronRight, X } from "lucide-react";
import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Order, OrderStatus } from "@/types/store";

const statuses: OrderStatus[] = ["Novo", "Aguardando pagamento", "Pago", "Preparando", "Enviado", "Entregue", "Cancelado"];

export function OrdersAdmin() {
  const { data } = useAdminData();
  const [selected, setSelected] = useState<Order | null>(null);
  return <><AdminPanel title="Pedidos demonstrativos" description="Pedidos gerados no checkout desta aplicação."><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Pagamento</th><th>Total</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td><strong>{order.code}</strong></td><td>{order.customer.name}</td><td>{formatDateTime(order.createdAt)}</td><td>{order.payment === "Cartao" ? "Cartão" : order.payment}</td><td>{formatMoney(order.total)}</td><td><StatusTag active={order.status !== "Cancelado"}>{order.status}</StatusTag></td><td><button className="admin-button" onClick={() => setSelected(order)}>Abrir <ChevronRight /></button></td></tr>)}</tbody></table></div></AdminPanel>{selected && <OrderDetail order={data.orders.find((order) => order.id === selected.id) ?? selected} onClose={() => setSelected(null)} />}</>;
}

function OrderDetail({ order, onClose }: { order: Order; onClose: () => void }) {
  const { updateOrderStatus } = useAdminData();
  const [status, setStatus] = useState(order.status);
  return <div className="admin-modal" role="dialog" aria-modal="true"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel"><header><div><span>PEDIDO</span><h2>{order.code}</h2><small>{formatDateTime(order.createdAt)}</small></div><button onClick={onClose}><X /></button></header><div className="order-details"><section><h3>Cliente</h3><p><strong>{order.customer.name}</strong></p><p>{order.customer.email}</p><p>{order.customer.phone}</p><p>{order.customer.address}, {order.customer.number}</p><p>{order.customer.city}/{order.customer.state} · CEP {order.customer.zip}</p></section><section><h3>Resumo</h3>{order.items.map((item) => <div className="order-item" key={`${item.productId}-${item.name}`}><span>{item.quantity}x {item.name}</span><strong>{formatMoney(item.unitPrice * item.quantity)}</strong></div>)}<div className="order-item"><span>Desconto</span><strong>- {formatMoney(order.discount)}</strong></div><div className="order-item"><span>Frete</span><strong>{formatMoney(order.shipping)}</strong></div><div className="order-item total"><span>Total</span><strong>{formatMoney(order.total)}</strong></div></section></div><div className="order-status-editor"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label><button className="admin-button primary" onClick={async () => { await updateOrderStatus(order.id, status); onClose(); }}>Atualizar status</button></div></div></div>;
}
