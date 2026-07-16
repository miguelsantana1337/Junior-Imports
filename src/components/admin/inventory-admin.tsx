"use client";

import { IconAlertTriangle, IconArrowsExchange, IconBuildingWarehouse, IconCalendarDue, IconPackage } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { formatDateTime, formatMoney } from "@/lib/format";
import { inventoryAlerts, movementStockDelta, productProfit } from "@/lib/operations";
import { inventoryMovementSchema } from "@/lib/validation";
import type { InventoryMovement, InventoryMovementType, ProductLot } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel } from "./admin-ui";

const movementLabels: Record<InventoryMovementType, string> = { opening: "Saldo inicial", purchase: "Entrada de compra", sale: "Saída de venda", return: "Devolução", adjustment: "Ajuste positivo", loss: "Perda/avaria", transfer: "Transferência recebida" };

export function InventoryAdmin() {
  const { data, currentUser, recordInventoryMovement, saveProductLot } = useAdminData();
  const [movementOpen, setMovementOpen] = useState(false);
  const [lotOpen, setLotOpen] = useState(false);
  const [referenceTime] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [movement, setMovement] = useState({ productId: "", type: "adjustment" as InventoryMovementType, quantity: 1, unitCost: 0, note: "" });
  const [lot, setLot] = useState<ProductLot>(() => ({ id: crypto.randomUUID(), productId: "", code: "", expiryDate: "", quantity: 0, status: "available", createdAt: new Date().toISOString() }));
  const alerts = useMemo(() => inventoryAlerts(data.products), [data.products]);
  const totalUnits = data.products.reduce((sum, product) => sum + product.stock, 0);
  const stockValue = data.products.reduce((sum, product) => sum + product.stock * product.costPrice, 0);
  const expiringLots = data.productLots.filter((item) => item.expiryDate && new Date(item.expiryDate).getTime() - referenceTime <= 120 * 86_400_000).length;

  async function submitMovement(event: React.FormEvent) {
    event.preventDefault();
    const parsed = inventoryMovementSchema.safeParse(movement);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise o movimento."); return; }
    const product = data.products.find((item) => item.id === movement.productId);
    if (!product) { setError("Selecione um produto válido."); return; }
    const delta = movementStockDelta(movement.type, movement.quantity);
    const balanceAfter = product.stock + delta;
    if (balanceAfter < 0) { setError(`Estoque insuficiente. Saldo atual: ${product.stock}.`); return; }
    const record: InventoryMovement = { id: crypto.randomUUID(), productId: product.id, type: movement.type, quantity: delta, balanceAfter, unitCost: movement.unitCost || product.costPrice, referenceType: "manual", referenceId: "", note: movement.note, actorEmail: currentUser.email, createdAt: new Date().toISOString() };
    await recordInventoryMovement(record);
    setMovement({ productId: "", type: "adjustment", quantity: 1, unitCost: 0, note: "" }); setMovementOpen(false); setError("");
  }

  async function submitLot(event: React.FormEvent) {
    event.preventDefault();
    if (!lot.productId || !lot.code.trim() || !lot.expiryDate || lot.quantity < 0) { setError("Informe produto, lote, validade e quantidade."); return; }
    await saveProductLot(lot);
    setLot({ id: crypto.randomUUID(), productId: "", code: "", expiryDate: "", quantity: 0, status: "available", createdAt: new Date().toISOString() }); setLotOpen(false); setError("");
  }

  return <div className="ops-page">
    <section className="ops-hero"><div><span>ERP · ESTOQUE</span><h2>Saldo confiável, movimentos rastreáveis.</h2><p>Acompanhe estoque mínimo, valor imobilizado, lotes, validade e cada alteração realizada.</p></div><div className="ops-hero-actions"><button className="admin-button" onClick={() => { setLotOpen(true); setMovementOpen(false); }}><IconCalendarDue /> Novo lote</button><button className="admin-button primary" onClick={() => { setMovementOpen(true); setLotOpen(false); }}><IconArrowsExchange /> Movimentar estoque</button></div></section>
    <section className="ops-metric-grid"><article><span className="blue"><IconPackage /></span><div><small>Unidades em estoque</small><strong>{totalUnits}</strong><p>{data.products.length} produtos cadastrados</p></div></article><article><span className="purple"><IconBuildingWarehouse /></span><div><small>Valor do estoque</small><strong>{formatMoney(stockValue)}</strong><p>calculado pelo custo atual</p></div></article><article><span className={alerts.length ? "warning" : "green"}><IconAlertTriangle /></span><div><small>Reposição</small><strong>{alerts.length}</strong><p>abaixo ou no estoque mínimo</p></div></article><article><span className={expiringLots ? "danger" : "green"}><IconCalendarDue /></span><div><small>Validade próxima</small><strong>{expiringLots}</strong><p>lotes nos próximos 120 dias</p></div></article></section>

    {movementOpen && <AdminPanel title="Registrar movimento" description="Toda alteração gera histórico com usuário, motivo e saldo resultante."><form className="ops-form" onSubmit={submitMovement}><label>Produto<select value={movement.productId} onChange={(event) => { const product = data.products.find((item) => item.id === event.target.value); setMovement((current) => ({ ...current, productId: event.target.value, unitCost: product?.costPrice ?? 0 })); }}><option value="">Selecione</option>{data.products.map((product) => <option value={product.id} key={product.id}>{product.name} · saldo {product.stock}</option>)}</select></label><label>Movimento<select value={movement.type} onChange={(event) => setMovement((current) => ({ ...current, type: event.target.value as InventoryMovementType }))}>{Object.entries(movementLabels).filter(([value]) => value !== "opening").map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Quantidade<input type="number" min="1" value={movement.quantity} onChange={(event) => setMovement((current) => ({ ...current, quantity: Number(event.target.value) }))} /></label><label>Custo unitário<input type="number" min="0" step="0.01" value={movement.unitCost} onChange={(event) => setMovement((current) => ({ ...current, unitCost: Number(event.target.value) }))} /></label><label className="wide">Motivo<input value={movement.note} onChange={(event) => setMovement((current) => ({ ...current, note: event.target.value }))} placeholder="Ex.: conferência do inventário" /></label>{error && <p className="admin-form-error wide">{error}</p>}<div className="ops-form-actions wide"><button type="button" className="admin-button" onClick={() => setMovementOpen(false)}>Cancelar</button><button className="admin-button primary">Registrar movimento</button></div></form></AdminPanel>}
    {lotOpen && <AdminPanel title="Cadastrar lote" description="Controle quantidade, validade e bloqueio por lote."><form className="ops-form" onSubmit={submitLot}><label>Produto<select value={lot.productId} onChange={(event) => setLot((current) => ({ ...current, productId: event.target.value }))}><option value="">Selecione</option>{data.products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label><label>Código do lote<input value={lot.code} onChange={(event) => setLot((current) => ({ ...current, code: event.target.value }))} /></label><label>Validade<input type="date" value={lot.expiryDate} onChange={(event) => setLot((current) => ({ ...current, expiryDate: event.target.value }))} /></label><label>Quantidade<input type="number" min="0" value={lot.quantity} onChange={(event) => setLot((current) => ({ ...current, quantity: Number(event.target.value) }))} /></label><label>Situação<select value={lot.status} onChange={(event) => setLot((current) => ({ ...current, status: event.target.value as ProductLot["status"] }))}><option value="available">Disponível</option><option value="blocked">Bloqueado</option><option value="expired">Vencido</option></select></label>{error && <p className="admin-form-error wide">{error}</p>}<div className="ops-form-actions wide"><button type="button" className="admin-button" onClick={() => setLotOpen(false)}>Cancelar</button><button className="admin-button primary">Salvar lote</button></div></form></AdminPanel>}

    <div className="ops-two-columns inventory-layout"><AdminPanel title="Posição de estoque" description="Saldo, mínimo, custo e margem por produto."><div className="admin-table-wrap"><table className="admin-table ops-table"><thead><tr><th>Produto</th><th>Saldo</th><th>Mínimo</th><th>Custo</th><th>Margem</th><th>Situação</th></tr></thead><tbody>{data.products.map((product) => { const profit = productProfit(product); const low = product.stock <= product.minStock; return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.sku}</small></td><td><b>{product.stock}</b></td><td>{product.minStock}</td><td>{product.costPrice ? formatMoney(product.costPrice) : "Não informado"}</td><td>{product.costPrice ? `${profit.marginPercent.toFixed(1)}%` : "—"}</td><td><span className={`inventory-state ${low ? "low" : "ok"}`}>{low ? "Repor" : "Saudável"}</span></td></tr>; })}</tbody></table></div></AdminPanel><div className="ops-side-stack"><section className="ops-lot-list"><header><div><h3>Lotes e validades</h3><p>Mais próximos primeiro.</p></div></header>{data.productLots.map((item) => <article key={item.id}><div><strong>{data.products.find((product) => product.id === item.productId)?.name ?? "Produto"}</strong><small>Lote {item.code} · {item.quantity} un.</small></div><span className={item.status}>{item.expiryDate || "Sem validade"}</span></article>)}{!data.productLots.length && <AdminEmpty><IconCalendarDue /><strong>Nenhum lote cadastrado.</strong></AdminEmpty>}</section></div></div>
    <AdminPanel title="Últimos movimentos" description="Razão imutável de entradas, saídas e ajustes."><div className="inventory-movement-list">{data.inventoryMovements.map((item) => <article key={item.id}><span className={item.quantity >= 0 ? "in" : "out"}>{item.quantity >= 0 ? "+" : ""}{item.quantity}</span><div><strong>{data.products.find((product) => product.id === item.productId)?.name ?? "Produto"}</strong><p>{movementLabels[item.type]} · saldo após movimento: {item.balanceAfter}</p><small>{item.note} · {item.actorEmail} · {formatDateTime(item.createdAt)}</small></div><b>{item.unitCost ? formatMoney(item.unitCost) : "—"}</b></article>)}{!data.inventoryMovements.length && <AdminEmpty><IconArrowsExchange /><strong>Nenhum movimento registrado.</strong></AdminEmpty>}</div></AdminPanel>
  </div>;
}
