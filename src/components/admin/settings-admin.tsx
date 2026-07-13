"use client";

import { ImagePlus, Palette, Store, Upload } from "lucide-react";
import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";
import { settingsSchema } from "@/lib/validation";
import type { StoreSettings } from "@/types/store";

export function SettingsAdmin() {
  const { data, saveSettings, uploadMedia } = useAdminData();
  const [form, setForm] = useState<StoreSettings>(data.settings);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  function field<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function upload(file: File, kind: "logo" | "favicon") {
    setUploading(kind);
    try { field(kind === "logo" ? "logoUrl" : "faviconUrl", await uploadMedia(file, "site-media")); }
    finally { setUploading(null); }
  }

  return <form className="settings-builder" onSubmit={async (event) => { event.preventDefault(); const parsed = settingsSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await saveSettings(form); setError(""); }}>
    <AdminPanel title="Marca da loja" description="Troque a logo, o favicon e o nome exibidos em toda a experiência.">
      <div className="brand-settings-grid">
        <div className="brand-upload-card"><div className="brand-preview" style={{ backgroundImage: `url(${form.logoUrl || "/admin-brand.png"})` }} /><div><strong>Logo principal</strong><span>PNG, JPG, WEBP ou SVG. Recomendado: fundo transparente.</span><label className="admin-button"><ImagePlus /> {uploading === "logo" ? "Enviando..." : "Enviar logo"}<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file, "logo"); }} /></label><button className="admin-button" type="button" onClick={() => field("logoUrl", "")}>Usar marca padrão</button></div></div>
        <div className="brand-upload-card compact"><div className="favicon-preview" style={{ backgroundImage: `url(${form.faviconUrl || "/favicon.svg"})` }} /><div><strong>Favicon</strong><span>Ícone exibido na aba do navegador.</span><label className="admin-button"><Upload /> {uploading === "favicon" ? "Enviando..." : "Enviar favicon"}<input type="file" accept="image/png,image/svg+xml,image/x-icon,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file, "favicon"); }} /></label><button className="admin-button" type="button" onClick={() => field("faviconUrl", "")}>Usar padrão</button></div></div>
      </div>
      <div className="admin-form settings-identity-form"><label>Nome da loja<input value={form.storeName} onChange={(event) => field("storeName", event.target.value)} /></label><label>URL da logo<input value={form.logoUrl} onChange={(event) => field("logoUrl", event.target.value)} placeholder="https://..." /></label><label className="full">URL do favicon<input value={form.faviconUrl} onChange={(event) => field("faviconUrl", event.target.value)} placeholder="https://..." /></label></div>
    </AdminPanel>

    <AdminPanel title="Tema e layout global" description="Ajuste cores, tipografia, largura e arredondamento da vitrine.">
      <div className="admin-form settings-theme-form"><div className="admin-form-section full"><Palette /><div><strong>Identidade visual</strong><span>Essas escolhas viram o padrão dos novos containers.</span></div></div><label>Cor principal<input type="color" value={form.primaryColor} onChange={(event) => field("primaryColor", event.target.value)} /></label><label>Cor de destaque<input type="color" value={form.secondaryColor} onChange={(event) => field("secondaryColor", event.target.value)} /></label><label>Fundo da loja<input type="color" value={form.backgroundColor} onChange={(event) => field("backgroundColor", event.target.value)} /></label><label>Cor do texto<input type="color" value={form.textColor} onChange={(event) => field("textColor", event.target.value)} /></label><label>Tipografia<select value={form.fontFamily} onChange={(event) => field("fontFamily", event.target.value as StoreSettings["fontFamily"])}><option value="Inter">Inter</option><option value="Manrope">Manrope</option><option value="Poppins">Poppins</option><option value="System">Fonte do sistema</option></select></label><label>Posição da marca<select value={form.headerLayout} onChange={(event) => field("headerLayout", event.target.value as StoreSettings["headerLayout"])}><option value="left">À esquerda</option><option value="center">Centralizada</option></select></label><label>Largura do conteúdo (px)<input type="number" min="960" max="1600" step="20" value={form.contentWidth} onChange={(event) => field("contentWidth", Number(event.target.value))} /></label><label>Arredondamento (px)<input type="number" min="0" max="40" value={form.borderRadius} onChange={(event) => field("borderRadius", Number(event.target.value))} /></label></div>
    </AdminPanel>

    <AdminPanel title="Operação da loja" description="Contato, anúncios, frete e condições demonstrativas.">
      <div className="admin-form settings-form"><div className="admin-form-section full"><Store /><div><strong>Dados operacionais</strong><span>Informações usadas no cabeçalho, rodapé e checkout.</span></div></div><label>WhatsApp<input value={form.whatsapp} onChange={(event) => field("whatsapp", event.target.value)} /></label><label>E-mail<input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} /></label><label>Horário<input value={form.hours} onChange={(event) => field("hours", event.target.value)} /></label><label>Troca dos banners (segundos)<input type="number" min="3" max="30" value={form.autoBannerSeconds} onChange={(event) => field("autoBannerSeconds", Number(event.target.value))} /></label><label className="full">Barra de anúncio<input value={form.announcement} onChange={(event) => field("announcement", event.target.value)} /></label><label className="full">Descrição do rodapé<textarea value={form.footerDescription} onChange={(event) => field("footerDescription", event.target.value)} /></label><label>Frete fixo<input type="number" min="0" step="0.01" value={form.shippingFlat} onChange={(event) => field("shippingFlat", Number(event.target.value))} /></label><label>Frete grátis acima de<input type="number" min="0" step="0.01" value={form.freeShippingThreshold} onChange={(event) => field("freeShippingThreshold", Number(event.target.value))} /></label><label>Desconto no Pix (%)<input type="number" min="0" max="100" step="0.1" value={form.pixDiscount} onChange={(event) => field("pixDiscount", Number(event.target.value))} /></label></div>
    </AdminPanel>
    {error && <p className="admin-form-error settings-save-error">{error}</p>}
    <div className="settings-save-bar"><div><strong>Configuração da loja</strong><span>As mudanças aparecem na vitrine assim que forem salvas.</span></div><button className="admin-button primary">Salvar configurações</button></div>
  </form>;
}
