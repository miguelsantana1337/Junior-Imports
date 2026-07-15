"use client";

import { Clock3, Pencil, Plus, TicketCheck, Trash2, UsersRound, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatDateTime, formatMoney } from "@/lib/format";
import { couponSchema } from "@/lib/validation";
import type { Coupon } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";

const emptyCoupon = (): Coupon => ({
  id: crypto.randomUUID(),
  code: "",
  type: "percent",
  value: 10,
  minimum: 0,
  active: true,
  startsAt: "",
  expiresAt: "",
  totalUsageLimit: 0,
  perCustomerLimit: 1,
  firstOrderOnly: false,
  usageCount: 0,
});

export function CouponsAdmin() {
  const { data, deleteCoupon } = useAdminData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const searchParams = useSearchParams();
  useEffect(() => { if (searchParams.get("novo") === "1") setEditing("new"); }, [searchParams]);
  const active = data.coupons.filter((coupon) => coupon.active).length;
  const totalUses = data.couponRedemptions.filter((item) => item.status === "used").length || data.coupons.reduce((sum, coupon) => sum + coupon.usageCount, 0);

  return <>
    <section className="coupon-summary-grid"><article><TicketCheck /><div><span>Cupons ativos</span><strong>{active}</strong><small>de {data.coupons.length} cadastrados</small></div></article><article><UsersRound /><div><span>Utilizações</span><strong>{totalUses}</strong><small>pedidos com desconto</small></div></article><article><Clock3 /><div><span>Com limite individual</span><strong>{data.coupons.filter((coupon) => coupon.perCustomerLimit > 0).length}</strong><small>proteções por cliente</small></div></article></section>
    <div className="admin-inline-note">O limite individual identifica o cliente pelo e-mail ou pelo número de WhatsApp informado no checkout. Se qualquer um deles já tiver usado o cupom, a utilização será contabilizada.</div>
    <AdminPanel title="Cupons e regras de utilização" description="Controle período, limite total, usos por cliente e primeira compra." action={<button className="admin-button primary" onClick={() => setEditing("new")}><Plus /> Adicionar cupom</button>}>
      {data.coupons.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Código</th><th>Desconto</th><th>Período</th><th>Limite por cliente</th><th>Utilizações</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.coupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong><small className="table-secondary">Mínimo {formatMoney(coupon.minimum)}</small></td><td>{coupon.type === "percent" ? `${coupon.value}%` : formatMoney(coupon.value)}</td><td>{coupon.startsAt || coupon.expiresAt ? `${coupon.startsAt ? new Date(`${coupon.startsAt}T12:00:00`).toLocaleDateString("pt-BR") : "Agora"} → ${coupon.expiresAt ? new Date(`${coupon.expiresAt}T12:00:00`).toLocaleDateString("pt-BR") : "Sem fim"}` : "Sem prazo"}</td><td>{coupon.perCustomerLimit > 0 ? `${coupon.perCustomerLimit} uso${coupon.perCustomerLimit === 1 ? "" : "s"}` : "Ilimitado"}{coupon.firstOrderOnly && <small className="table-secondary">Somente 1ª compra</small>}</td><td><strong>{coupon.usageCount}</strong>{coupon.totalUsageLimit > 0 && <small className="table-secondary">de {coupon.totalUsageLimit}</small>}</td><td><StatusTag active={coupon.active}>{coupon.active ? "Ativo" : "Inativo"}</StatusTag></td><td><div className="admin-actions"><button aria-label={`Editar ${coupon.code}`} onClick={() => setEditing(coupon)}><Pencil /></button><button className="danger" aria-label={`Excluir ${coupon.code}`} onClick={async () => { const accepted = await confirm({ title: "Excluir cupom?", description: `O cupom ${coupon.code} deixará de ficar disponível.`, confirmLabel: "Excluir cupom", danger: true }); if (accepted) await deleteCoupon(coupon.id); }}><Trash2 /></button></div></td></tr>)}</tbody></table></div> : <AdminEmpty><TicketCheck /><strong>Nenhum cupom cadastrado.</strong><span>Crie uma campanha e defina quantas vezes cada cliente poderá utilizá-la.</span></AdminEmpty>}
    </AdminPanel>

    <AdminPanel title="Utilizações recentes" description="Histórico usado para identificar clientes pelo e-mail ou WhatsApp.">
      {data.couponRedemptions.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Data</th><th>Cupom</th><th>Cliente</th><th>Pedido</th><th>Desconto</th><th>Status</th></tr></thead><tbody>{data.couponRedemptions.slice(0, 30).map((item) => <tr key={item.id}><td>{formatDateTime(item.usedAt)}</td><td><strong>{item.couponCode}</strong></td><td>{item.normalizedEmail || item.normalizedPhone}</td><td>{item.orderId}</td><td>{formatMoney(item.discount)}</td><td><StatusTag active={item.status === "used"}>{item.status === "used" ? "Utilizado" : "Liberado"}</StatusTag></td></tr>)}</tbody></table></div> : <AdminEmpty><strong>Nenhuma utilização registrada.</strong><span>O histórico será preenchido quando novos pedidos usarem cupons.</span></AdminEmpty>}
    </AdminPanel>
    {editing && <CouponEditor coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
  </>;
}

function CouponEditor({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const { saveCoupon } = useAdminData();
  const [form, setForm] = useState<Coupon>(coupon ?? emptyCoupon());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const field = <K extends keyof Coupon>(key: K, value: Coupon[K]) => setForm((current) => ({ ...current, [key]: value }));

  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="coupon-editor-title"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel coupon-editor-panel"><header><div><span>CUPONS</span><h2 id="coupon-editor-title">{coupon ? "Editar cupom" : "Novo cupom"}</h2><small>Zero significa sem limite.</small></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><form className="admin-form coupon-editor-form" onSubmit={async (event) => { event.preventDefault(); const parsed = couponSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } setSaving(true); try { await saveCoupon({ ...form, code: form.code.toUpperCase() }); onClose(); } finally { setSaving(false); } }}>
    <div className="admin-form-section full"><TicketCheck /><div><strong>Identificação e desconto</strong><span>Configure a condição comercial da campanha.</span></div></div>
    <label>Código<input value={form.code} onChange={(event) => field("code", event.target.value.toUpperCase())} placeholder="LANCAMENTO" /></label>
    <label>Tipo<select value={form.type} onChange={(event) => field("type", event.target.value as Coupon["type"])}><option value="percent">Percentual</option><option value="fixed">Valor fixo</option></select></label>
    <label>Valor<input type="number" min="0" step="0.01" value={form.value} onChange={(event) => field("value", Number(event.target.value))} /></label>
    <label>Pedido mínimo<input type="number" min="0" step="0.01" value={form.minimum} onChange={(event) => field("minimum", Number(event.target.value))} /></label>
    <div className="admin-form-section full"><Clock3 /><div><strong>Período e limites</strong><span>Controle a campanha e evite utilizações repetidas.</span></div></div>
    <label>Início<input type="date" value={form.startsAt} onChange={(event) => field("startsAt", event.target.value)} /></label>
    <label>Validade<input type="date" value={form.expiresAt} onChange={(event) => field("expiresAt", event.target.value)} /></label>
    <label>Limite total<input type="number" min="0" step="1" value={form.totalUsageLimit} onChange={(event) => field("totalUsageLimit", Number(event.target.value))} /><small>Ex.: 100 usos na campanha.</small></label>
    <label>Limite por cliente<input type="number" min="0" step="1" value={form.perCustomerLimit} onChange={(event) => field("perCustomerLimit", Number(event.target.value))} /><small>Identificado por e-mail ou WhatsApp.</small></label>
    <label className="check-field full"><input type="checkbox" checked={form.firstOrderOnly} onChange={(event) => field("firstOrderOnly", event.target.checked)} /> Válido somente para a primeira compra</label>
    <label className="check-field full"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Cupom ativo</label>
    {coupon && <p className="coupon-usage-note full">Este cupom já possui <strong>{coupon.usageCount}</strong> utilização{coupon.usageCount === 1 ? "" : "ões"} registrada{coupon.usageCount === 1 ? "" : "s"}.</p>}
    {error && <p className="admin-form-error full">{error}</p>}
    <div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : "Salvar cupom"}</button></div>
  </form></div></div>;
}
