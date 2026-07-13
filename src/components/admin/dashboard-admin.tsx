"use client";

import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import { formatDateTime, formatMoney } from "@/lib/format";

export function DashboardAdmin() {
  const { data } = useAdminData();
  const revenue = data.orders.reduce((sum, order) => sum + order.total, 0);
  const activeProducts = data.products.filter((product) => product.active).length;
  const average = data.orders.length ? revenue / data.orders.length : 0;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const day = date.toISOString().slice(0, 10);
    return {
      label: date.toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3),
      value: data.orders.filter((order) => order.createdAt.slice(0, 10) === day).reduce((sum, order) => sum + order.total, 0),
    };
  });
  const max = Math.max(...days.map((day) => day.value), 1);
  return <><div className="admin-stats"><article><span>PRODUTOS ATIVOS</span><strong>{activeProducts}</strong><small>{data.products.length - activeProducts} ocultos</small></article><article><span>PEDIDOS</span><strong>{data.orders.length}</strong><small>{data.orders.filter((order) => order.status === "Novo").length} novos</small></article><article><span>RECEITA SIMULADA</span><strong>{formatMoney(revenue)}</strong><small>Todos os pedidos</small></article><article><span>TICKET MÉDIO</span><strong>{formatMoney(average)}</strong><small>Valor demonstrativo</small></article></div><AdminPanel title="Receita dos últimos 7 dias" description="Pedidos demonstrativos registrados na aplicação."><div className="chart-bars">{days.map((day) => <div className="chart-bar-wrap" key={day.label}><div className="chart-bar" style={{ height: `${Math.max(4, (day.value / max) * 100)}%` }} /><span>{day.label}</span></div>)}</div></AdminPanel><AdminPanel title="Pedidos recentes" description="Últimas simulações realizadas."><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Data</th><th>Total</th><th>Status</th></tr></thead><tbody>{data.orders.slice(0, 6).map((order) => <tr key={order.id}><td><strong>{order.code}</strong></td><td>{order.customer.name}</td><td>{formatDateTime(order.createdAt)}</td><td>{formatMoney(order.total)}</td><td><StatusTag active={order.status !== "Cancelado"}>{order.status}</StatusTag></td></tr>)}</tbody></table></div></AdminPanel></>;
}
