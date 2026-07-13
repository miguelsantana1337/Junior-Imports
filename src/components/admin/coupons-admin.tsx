"use client";

import { Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import { formatMoney } from "@/lib/format";
import { couponSchema } from "@/lib/validation";
import type { Coupon } from "@/types/store";

export function CouponsAdmin() {
  const { data, deleteCoupon } = useAdminData();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  return <><AdminPanel title="Cupons de desconto" description="Configure percentual, valor fixo, mínimo e validade." action={<button className="admin-button primary" onClick={() => setEditing("new")}><Plus /> Adicionar cupom</button>}><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Mínimo</th><th>Validade</th><th>Status</th><th>Ações</th></tr></thead><tbody>{data.coupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong></td><td>{coupon.type === "percent" ? "Percentual" : "Valor fixo"}</td><td>{coupon.type === "percent" ? `${coupon.value}%` : formatMoney(coupon.value)}</td><td>{formatMoney(coupon.minimum)}</td><td>{coupon.expiresAt ? new Date(`${coupon.expiresAt}T12:00:00`).toLocaleDateString("pt-BR") : "Sem validade"}</td><td><StatusTag active={coupon.active}>{coupon.active ? "Ativo" : "Inativo"}</StatusTag></td><td><div className="admin-actions"><button onClick={() => setEditing(coupon)}><Pencil /></button><button className="danger" onClick={() => window.confirm("Excluir este cupom?") && deleteCoupon(coupon.id)}><Trash2 /></button></div></td></tr>)}</tbody></table></div></AdminPanel>{editing && <CouponEditor coupon={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</>;
}

function CouponEditor({ coupon, onClose }: { coupon: Coupon | null; onClose: () => void }) {
  const { saveCoupon } = useAdminData();
  const [form, setForm] = useState<Coupon>(coupon ?? { id: crypto.randomUUID(), code: "", type: "percent", value: 10, minimum: 0, active: true, expiresAt: "" });
  const [error, setError] = useState("");
  function field<K extends keyof Coupon>(key: K, value: Coupon[K]) { setForm((current) => ({ ...current, [key]: value })); }
  return <div className="admin-modal" role="dialog" aria-modal="true"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel small"><header><div><span>CUPONS</span><h2>{coupon ? "Editar cupom" : "Novo cupom"}</h2></div><button onClick={onClose}><X /></button></header><form className="admin-form" onSubmit={async (event) => { event.preventDefault(); const parsed = couponSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await saveCoupon({ ...form, code: form.code.toUpperCase() }); onClose(); }}><label>Código<input value={form.code} onChange={(event) => field("code", event.target.value.toUpperCase())} /></label><label>Tipo<select value={form.type} onChange={(event) => field("type", event.target.value as Coupon["type"])}><option value="percent">Percentual</option><option value="fixed">Valor fixo</option></select></label><label>Valor<input type="number" min="0" step="0.01" value={form.value} onChange={(event) => field("value", Number(event.target.value))} /></label><label>Pedido mínimo<input type="number" min="0" step="0.01" value={form.minimum} onChange={(event) => field("minimum", Number(event.target.value))} /></label><label>Validade<input type="date" value={form.expiresAt} onChange={(event) => field("expiresAt", event.target.value)} /></label><label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Cupom ativo</label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary">Salvar cupom</button></div></form></div></div>;
}
