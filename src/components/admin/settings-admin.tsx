"use client";

import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";
import { settingsSchema } from "@/lib/validation";
import type { StoreSettings } from "@/types/store";

export function SettingsAdmin() {
  const { data, saveSettings } = useAdminData();
  const [form, setForm] = useState<StoreSettings>(data.settings);
  const [error, setError] = useState("");
  function field<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) { setForm((current) => ({ ...current, [key]: value })); }
  return <AdminPanel title="Configurações da loja" description="Dados gerais, frete, pagamento e identidade visual."><form className="admin-form settings-form" onSubmit={async (event) => { event.preventDefault(); const parsed = settingsSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await saveSettings(form); setError(""); }}><label>Nome da loja<input value={form.storeName} onChange={(event) => field("storeName", event.target.value)} /></label><label>WhatsApp<input value={form.whatsapp} onChange={(event) => field("whatsapp", event.target.value)} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} /></label><label>Horário<input value={form.hours} onChange={(event) => field("hours", event.target.value)} /></label><label className="full">Barra de anúncio<input value={form.announcement} onChange={(event) => field("announcement", event.target.value)} /></label><label className="full">Descrição do rodapé<textarea value={form.footerDescription} onChange={(event) => field("footerDescription", event.target.value)} /></label><label>Cor principal<input type="color" value={form.primaryColor} onChange={(event) => field("primaryColor", event.target.value)} /></label><label>Troca dos banners (segundos)<input type="number" min="3" max="30" value={form.autoBannerSeconds} onChange={(event) => field("autoBannerSeconds", Number(event.target.value))} /></label><label>Frete fixo<input type="number" min="0" step="0.01" value={form.shippingFlat} onChange={(event) => field("shippingFlat", Number(event.target.value))} /></label><label>Frete grátis acima de<input type="number" min="0" step="0.01" value={form.freeShippingThreshold} onChange={(event) => field("freeShippingThreshold", Number(event.target.value))} /></label><label>Desconto no Pix (%)<input type="number" min="0" max="100" step="0.1" value={form.pixDiscount} onChange={(event) => field("pixDiscount", Number(event.target.value))} /></label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button className="admin-button primary">Salvar configurações</button></div></form></AdminPanel>;
}
