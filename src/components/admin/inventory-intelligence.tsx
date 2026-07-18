"use client";

import { AlertOctagon, AlertTriangle, ArrowRight, BadgeDollarSign, CircleCheck, Clock3, PackagePlus, ShoppingCart, Snail } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { inventoryInsights, type InventoryInsight } from "@/lib/reporting";
import type { PurchaseOrder } from "@/types/store";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty } from "./admin-ui";

type InsightFilter = "all" | InventoryInsight["severity"] | "reorder" | "slow" | "margin";

const filterLabels: Record<InsightFilter, string> = { all: "Todos", critical: "Ruptura", warning: "Ponto mínimo", attention: "Atenção", healthy: "Saudáveis", reorder: "Compra sugerida", slow: "Baixo giro", margin: "Margem" };

export function InventoryIntelligence() {
  const { data, savePurchaseOrder } = useAdminData();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<InsightFilter>("all");
  const [lookback, setLookback] = useState(90);
  const [referenceTime] = useState(() => new Date());
  const insights = useMemo(() => inventoryInsights(data, lookback, referenceTime), [data, lookback, referenceTime]);
  const filtered = insights.filter((item) => filter === "all" || item.severity === filter || (filter === "reorder" && item.suggestedQuantity > 0) || (filter === "slow" && item.soldUnits === 0 && item.stock > 0) || (filter === "margin" && (item.marginPercent < 20 || item.flags.includes("Custo não informado"))));
  const critical = insights.filter((item) => item.severity === "critical").length;
  const reorder = insights.filter((item) => item.suggestedQuantity > 0).length;
  const slow = insights.filter((item) => item.soldUnits === 0 && item.stock > 0).length;
  const lowMargin = insights.filter((item) => item.marginPercent < 20 || item.flags.includes("Custo não informado")).length;

  async function createSuggestedOrder(insight: InventoryInsight) {
    const product = data.products.find((item) => item.id === insight.productId);
    const supplier = [...data.purchaseOrders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .find((order) => order.items.some((item) => item.productId === insight.productId))
      ?.supplierId;
    const supplierId = data.suppliers.find((item) => item.id === supplier && item.active)?.id || data.suppliers.find((item) => item.active)?.id;
    if (!product || !supplierId || insight.suggestedQuantity < 1 || product.costPrice <= 0) return;
    const accepted = await confirm({ title: `Criar rascunho de compra para ${product.name}?`, description: `Serão sugeridas ${insight.suggestedQuantity} unidades, considerando ${insight.leadTimeDays} dias de prazo e o giro dos últimos ${lookback} dias.`, confirmLabel: "Criar rascunho" });
    if (!accepted) return;
    const expected = new Date();
    expected.setDate(expected.getDate() + insight.leadTimeDays);
    const id = crypto.randomUUID();
    const order: PurchaseOrder = {
      id, code: `OC-SUG-${id.slice(0, 7).toUpperCase()}`, supplierId, status: "draft", expectedAt: expected.toISOString().slice(0, 10), receivedAt: "",
      total: insight.suggestedQuantity * product.costPrice, notes: `Sugestão automática: giro de ${lookback} dias, ponto de reposição ${insight.reorderPoint} e cobertura projetada.`,
      items: [{ id: crypto.randomUUID(), productId: product.id, name: product.name, quantity: insight.suggestedQuantity, unitCost: product.costPrice, lotCode: "", expiryDate: "" }], createdAt: new Date().toISOString(),
    };
    await savePurchaseOrder(order);
  }

  return <section className="inventory-intelligence">
    <header className="inventory-intelligence-header"><div><span>PREVISÃO E DECISÃO</span><h3>Radar inteligente de estoque</h3><p>Giro, cobertura, prazo do fornecedor e margem consolidados em uma fila priorizada.</p></div><label>Janela de giro<select value={lookback} onChange={(event) => setLookback(Number(event.target.value))}><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option></select></label></header>
    <div className="inventory-insight-metrics"><button onClick={() => setFilter("critical")} className={filter === "critical" ? "active critical" : "critical"}><AlertOctagon /><span><strong>{critical}</strong>rupturas previstas</span></button><button onClick={() => setFilter("reorder")} className={filter === "reorder" ? "active warning" : "warning"}><PackagePlus /><span><strong>{reorder}</strong>compras sugeridas</span></button><button onClick={() => setFilter("slow")} className={filter === "slow" ? "active slow" : "slow"}><Snail /><span><strong>{slow}</strong>sem giro</span></button><button onClick={() => setFilter("margin")} className={filter === "margin" ? "active margin" : "margin"}><BadgeDollarSign /><span><strong>{lowMargin}</strong>margens a revisar</span></button></div>
    <nav className="inventory-insight-filters">{Object.entries(filterLabels).map(([value, label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value as InsightFilter)}>{label}</button>)}</nav>
    <div className="admin-table-wrap"><table className="admin-table inventory-insight-table"><thead><tr><th>Prioridade</th><th>Produto</th><th>Giro</th><th>Cobertura</th><th>Projeção</th><th>Compra sugerida</th><th>Margem</th><th>Ação</th></tr></thead><tbody>{filtered.map((item) => { const product = data.products.find((candidate) => candidate.id === item.productId); const canCreate = item.suggestedQuantity > 0 && data.suppliers.some((supplier) => supplier.active) && (product?.costPrice ?? 0) > 0; return <tr key={item.productId}><td><span className={`insight-severity ${item.severity}`}>{item.severity === "critical" ? <AlertOctagon /> : item.severity === "warning" ? <AlertTriangle /> : item.severity === "attention" ? <Clock3 /> : <CircleCheck />}{item.severity === "critical" ? "Crítica" : item.severity === "warning" ? "Repor" : item.severity === "attention" ? "Atenção" : "Saudável"}</span></td><td><strong>{item.name}</strong><small>{item.sku} · saldo {item.stock}</small>{item.flags.length > 0 && <em>{item.flags[0]}</em>}</td><td><b>{item.soldUnits} un.</b><small>{item.dailyDemand.toFixed(2)}/dia</small></td><td><b>{item.coverageDays === null ? "Sem giro" : `${item.coverageDays.toFixed(0)} dias`}</b><small>lead time {item.leadTimeDays}d</small></td><td><b className={item.projectedStock <= 0 ? "negative" : ""}>{item.projectedStock} un.</b><small>{item.incomingUnits} a caminho</small></td><td><strong>{item.suggestedQuantity} un.</strong><small>{product ? formatMoney(item.suggestedQuantity * product.costPrice) : "—"}</small></td><td><b>{item.marginPercent.toFixed(1)}%</b><small>margem bruta</small></td><td>{canCreate ? <button className="inventory-create-order" onClick={() => void createSuggestedOrder(item)}><ShoppingCart /> Criar rascunho</button> : item.suggestedQuantity > 0 ? <Link href="/admin/purchasing">Completar dados <ArrowRight /></Link> : <span className="inventory-no-action">Monitorar</span>}</td></tr>; })}{!filtered.length && <tr><td colSpan={8}><AdminEmpty><CircleCheck /><strong>Nenhum item neste filtro.</strong><span>O radar não encontrou pendências para a seleção atual.</span></AdminEmpty></td></tr>}</tbody></table></div>
    <footer><span><CircleCheck /> A sugestão nunca recebe a compra automaticamente.</span><span>O rascunho precisa ser revisado em Compras antes do envio ao fornecedor.</span></footer>
  </section>;
}
