"use client";

import { ArrowRight, BadgePercent, CalendarDays, CreditCard, Gift, ImagePlus, MapPin, MessageCircle, PackageCheck, Paintbrush, Palette, Plus, Store, Trash2, Truck, Upload } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";
import { settingsSchema } from "@/lib/validation";
import type { StoreSettings } from "@/types/store";
import { platformConfig } from "@/config/platform";
import { formatMoney, formatWhatsappDisplay } from "@/lib/format";

function toLocalDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDateTime(value: string) {
  return value ? new Date(value).toISOString() : "";
}

export function SettingsAdmin() {
  const { data, saveSettings, uploadMedia } = useAdminData();
  const [form, setForm] = useState<StoreSettings>(data.settings);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"logo" | "mobileLogo" | "favicon" | null>(null);
  function field<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function updateShippingRate(index: number, changes: Partial<StoreSettings["shippingCityRates"][number]>) {
    field("shippingCityRates", form.shippingCityRates.map((rate, rateIndex) => rateIndex === index ? { ...rate, ...changes } : rate));
  }
  async function upload(file: File, kind: "logo" | "mobileLogo" | "favicon") {
    setUploading(kind);
    try {
      const fieldName = kind === "logo" ? "logoUrl" : kind === "mobileLogo" ? "mobileLogoUrl" : "faviconUrl";
      field(fieldName, await uploadMedia(file, "site-media"));
    }
    finally { setUploading(null); }
  }

  return <form className="settings-builder" onSubmit={async (event) => { event.preventDefault(); const commercialForm = { ...form, checkoutMode: "whatsapp" as const }; const parsed = settingsSchema.safeParse(commercialForm); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await saveSettings(parsed.data); setForm(parsed.data); setError(""); }}>
    <AdminPanel title="Marca da loja" description="Troque a logo, o favicon e o nome exibidos em toda a experiência.">
      <div className="brand-settings-grid">
        <div className="brand-upload-card"><div className="brand-preview" style={{ backgroundImage: `url(${form.logoUrl || platformConfig.defaultLogoUrl})` }} /><div><strong>Logo principal</strong><span>Usada no desktop e como fallback. PNG, JPG, WEBP ou SVG.</span><label className="admin-button"><ImagePlus /> {uploading === "logo" ? "Enviando..." : "Enviar logo"}<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file, "logo"); }} /></label><button className="admin-button" type="button" onClick={() => field("logoUrl", "")}>Usar marca padrão</button></div></div>
        <div className="brand-upload-card mobile-logo-card"><div className="brand-preview" style={{ backgroundImage: `url(${form.mobileLogoUrl || form.logoUrl || platformConfig.defaultLogoUrl})` }} /><div><strong>Logo mobile</strong><span>Opcional. Aparece apenas em telas pequenas e evita cortes no cabeçalho.</span><label className="admin-button"><ImagePlus /> {uploading === "mobileLogo" ? "Enviando..." : "Enviar logo mobile"}<input type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file, "mobileLogo"); }} /></label><button className="admin-button" type="button" onClick={() => field("mobileLogoUrl", "")}>Usar logo principal</button></div></div>
        <div className="brand-upload-card compact"><div className="favicon-preview" style={{ backgroundImage: `url(${form.faviconUrl || platformConfig.defaultFaviconUrl})` }} /><div><strong>Favicon</strong><span>Ícone exibido na aba do navegador.</span><label className="admin-button"><Upload /> {uploading === "favicon" ? "Enviando..." : "Enviar favicon"}<input type="file" accept="image/png,image/svg+xml,image/x-icon,image/webp" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file, "favicon"); }} /></label><button className="admin-button" type="button" onClick={() => field("faviconUrl", "")}>Usar padrão</button></div></div>
      </div>
      <div className="admin-form settings-identity-form"><label>Nome da loja<input value={form.storeName} onChange={(event) => field("storeName", event.target.value)} /></label><label>URL da logo<input value={form.logoUrl} onChange={(event) => field("logoUrl", event.target.value)} placeholder="https://..." /></label><label>URL da logo mobile (opcional)<input value={form.mobileLogoUrl} onChange={(event) => field("mobileLogoUrl", event.target.value)} placeholder="https://..." /></label><label className="full">URL do favicon<input value={form.faviconUrl} onChange={(event) => field("faviconUrl", event.target.value)} placeholder="https://..." /></label></div>
    </AdminPanel>

    <AdminPanel title="Tema e layout global" description="Ajuste cores, tipografia, largura e arredondamento da vitrine.">
      <div className="admin-form settings-theme-form"><div className="admin-form-section full"><Palette /><div><strong>Identidade visual</strong><span>Essas escolhas viram o padrão dos novos containers.</span></div></div><label>Cor principal<input type="color" value={form.primaryColor} onChange={(event) => field("primaryColor", event.target.value)} /></label><label>Cor de destaque<input type="color" value={form.secondaryColor} onChange={(event) => field("secondaryColor", event.target.value)} /></label><label>Fundo da loja<input type="color" value={form.backgroundColor} onChange={(event) => field("backgroundColor", event.target.value)} /></label><label>Cor do texto<input type="color" value={form.textColor} onChange={(event) => field("textColor", event.target.value)} /></label><label>Tipografia<select value={form.fontFamily} onChange={(event) => field("fontFamily", event.target.value as StoreSettings["fontFamily"])}><option value="Inter">Inter</option><option value="Manrope">Manrope</option><option value="Poppins">Poppins</option><option value="System">Fonte do sistema</option></select></label><label>Posição da marca<select value={form.headerLayout} onChange={(event) => field("headerLayout", event.target.value as StoreSettings["headerLayout"])}><option value="left">À esquerda</option><option value="center">Centralizada</option></select></label><label>Largura do conteúdo (px)<input type="number" min="960" max="1600" step="20" value={form.contentWidth} onChange={(event) => field("contentWidth", Number(event.target.value))} /></label><label>Arredondamento (px)<input type="number" min="0" max="40" value={form.borderRadius} onChange={(event) => field("borderRadius", Number(event.target.value))} /></label></div>
    </AdminPanel>

    <AdminPanel title="Campanha comercial" description="Centralize a validade e as condições financeiras divulgadas na loja e aplicadas no checkout.">
      <div className="admin-form settings-form">
        <div className="admin-form-section full"><CalendarDays /><div><strong>Janela automática</strong><span>Ao terminar a validade, Pix, frete, parcelamento, fidelidade e brindes deixam de ser oferecidos automaticamente.</span></div></div>
        <label className={`shipping-option-card shipping-option-wide full ${form.promotionEnabled ? "active" : ""}`}><input type="checkbox" checked={form.promotionEnabled} onChange={(event) => field("promotionEnabled", event.target.checked)} /><BadgePercent /><span><strong>Ativar campanha temporária</strong><small>{form.promotionEnabled ? "As regras abaixo respeitam as datas configuradas." : "As regras comerciais funcionam sem prazo, como antes."}</small></span></label>
        <label className="full">Nome da campanha<input value={form.promotionName} onChange={(event) => field("promotionName", event.target.value)} /></label>
        <label>Início<input type="datetime-local" value={toLocalDateTime(form.promotionStartsAt)} onChange={(event) => field("promotionStartsAt", fromLocalDateTime(event.target.value))} disabled={!form.promotionEnabled} /></label>
        <label>Fim<input type="datetime-local" value={toLocalDateTime(form.promotionEndsAt)} onChange={(event) => field("promotionEndsAt", fromLocalDateTime(event.target.value))} disabled={!form.promotionEnabled} /></label>
        <label>Desconto no Pix (%)<input type="number" min="0" max="100" step="0.1" value={form.pixDiscount} onChange={(event) => field("pixDiscount", Number(event.target.value))} /></label>
        <label>Pix: pedido mínimo<input type="number" min="0" step="0.01" value={form.pixDiscountMinimum} onChange={(event) => field("pixDiscountMinimum", Number(event.target.value))} /></label>
        <label>Parcelas sem juros<input type="number" min="1" max="12" value={form.cardInstallments} onChange={(event) => field("cardInstallments", Number(event.target.value))} /></label>
        <label>Cartão: pedido mínimo<input type="number" min="0" step="0.01" value={form.cardInstallmentMinimum} onChange={(event) => field("cardInstallmentMinimum", Number(event.target.value))} /></label>
        <div className="admin-form-section full"><CreditCard /><div><strong>Condições no checkout</strong><span>O desconto do Pix é automático. O parcelamento é informado ao cliente e confirmado pelo WhatsApp.</span></div></div>
        <label className={`shipping-option-card shipping-option-wide full ${form.loyaltyDiscountEnabled ? "active" : ""}`}><input type="checkbox" checked={form.loyaltyDiscountEnabled} onChange={(event) => field("loyaltyDiscountEnabled", event.target.checked)} /><Gift /><span><strong>Recompensa de fidelidade</strong><small>Aplica o desconto no ciclo de compras configurado, com proteção contra duplicidade.</small></span></label>
        <label>Premiar a cada<input type="number" min="2" max="100" value={form.loyaltyOrderInterval} onChange={(event) => field("loyaltyOrderInterval", Number(event.target.value))} disabled={!form.loyaltyDiscountEnabled} /><small>Ex.: 6 significa 6ª, 12ª, 18ª compra...</small></label>
        <label>Valor do desconto<input type="number" min="0" step="0.01" value={form.loyaltyDiscountAmount} onChange={(event) => field("loyaltyDiscountAmount", Number(event.target.value))} disabled={!form.loyaltyDiscountEnabled} /></label>
        <label className="full">Benefícios exibidos (um por linha)<textarea rows={8} value={form.promotionHighlights.join("\n")} onChange={(event) => field("promotionHighlights", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean))} /></label>
        <label className="full">Brinde incluído no pedido<input value={form.promotionGiftMessage} onChange={(event) => field("promotionGiftMessage", event.target.value)} placeholder="Ex.: Coqueteleira + brindes nos pedidos" /></label>
        <label className="full">Mensagem de cobertura de preço<input value={form.promotionPriceMatchMessage} onChange={(event) => field("promotionPriceMatchMessage", event.target.value)} /></label>
      </div>
    </AdminPanel>

    <AdminPanel title="Operação da loja" description="Dados usados no atendimento, nos pedidos e na identificação da loja.">
      <div className="admin-form settings-form">
        <div className="admin-form-section full"><Store /><div><strong>Atendimento e pedidos</strong><span>Estas informações aparecem no checkout, no rodapé e nas mensagens enviadas ao cliente.</span></div></div>
        <label>WhatsApp<input value={form.whatsapp} onChange={(event) => field("whatsapp", event.target.value)} /></label>
        <label>Prefixo dos pedidos<input value={form.orderPrefix} maxLength={5} onChange={(event) => field("orderPrefix", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></label>
        <label>E-mail<input type="email" value={form.email} onChange={(event) => field("email", event.target.value)} /></label>
        <label>Horário de atendimento<input value={form.hours} onChange={(event) => field("hours", event.target.value)} /></label>
        <label className="full">Descrição da loja e prévia do link<textarea value={form.footerDescription} onChange={(event) => field("footerDescription", event.target.value)} /></label>
        <div className="settings-editor-shortcut full">
          <span className="settings-editor-shortcut-icon"><Paintbrush /></span>
          <div><small>CONTEÚDO DA VITRINE</small><strong>Anúncios, banners e campanhas</strong><p>A barra de anúncio, as imagens, o tempo dos banners e as campanhas agora são editados em um único lugar.</p></div>
          <Link className="admin-button" href="/admin/layout">Abrir Editor da loja <ArrowRight /></Link>
        </div>
      </div>
    </AdminPanel>
    <AdminPanel title="Frete e retirada" description="Defina como o checkout calcula entrega, cotação, retirada e frete grátis.">
      <div className="admin-form settings-form shipping-rules-form">
        <section className="shipping-rule-section full">
          <header><span>1</span><div><strong>Entregas locais</strong><p>Cadastre as cidades atendidas e o valor que será aplicado automaticamente após o CEP.</p></div></header>
          <div className="shipping-city-rates">
            {form.shippingCityRates.map((rate, index) => (
              <div className="shipping-city-rate" key={`${rate.city}-${rate.state}-${index}`}>
                <label>Cidade<input value={rate.city} onChange={(event) => updateShippingRate(index, { city: event.target.value })} placeholder="Ex.: Ipatinga" /></label>
                <label>UF<input value={rate.state} maxLength={2} onChange={(event) => updateShippingRate(index, { state: event.target.value.toUpperCase().replace(/[^A-Z]/g, "") })} placeholder="MG" /></label>
                <label>Valor<input type="number" min="0" step="0.01" value={rate.amount} onChange={(event) => updateShippingRate(index, { amount: Number(event.target.value) })} /></label>
                <button className="admin-icon-button" type="button" onClick={() => field("shippingCityRates", form.shippingCityRates.filter((_, rateIndex) => rateIndex !== index))} aria-label={`Remover tarifa de ${rate.city || "cidade"}`}><Trash2 /></button>
              </div>
            ))}
            <button className="admin-button shipping-add-city" type="button" onClick={() => field("shippingCityRates", [...form.shippingCityRates, { city: "", state: "MG", amount: 0 }])}><Plus /> Adicionar cidade</button>
          </div>
        </section>

        <section className="shipping-rule-section full">
          <header><span>2</span><div><strong>Outras formas de receber</strong><p>Escolha o que o cliente poderá fazer quando não houver uma tarifa local automática.</p></div></header>
          <div className="shipping-option-grid">
            <label className={`shipping-option-card ${form.quoteShippingOutsideCities ? "active" : ""}`}>
              <input type="checkbox" checked={form.quoteShippingOutsideCities} onChange={(event) => field("quoteShippingOutsideCities", event.target.checked)} />
              <PackageCheck /><span><strong>Cotar pelo CEP</strong><small>Para cidades não cadastradas, o frete será combinado no atendimento.</small></span>
            </label>
            <label className={`shipping-option-card ${form.localPickupEnabled ? "active" : ""}`}>
              <input type="checkbox" checked={form.localPickupEnabled} onChange={(event) => field("localPickupEnabled", event.target.checked)} />
              <Store /><span><strong>Retirada no local</strong><small>O cliente poderá retirar o pedido sem cobrança de frete.</small></span>
            </label>
          </div>
          {form.localPickupEnabled && <label className="shipping-rule-field">Orientação para retirada<textarea rows={3} value={form.localPickupInstructions} onChange={(event) => field("localPickupInstructions", event.target.value)} /><small>Esta mensagem aparece no checkout e segue junto ao pedido no WhatsApp.</small></label>}
          <label className="shipping-rule-field shipping-flat-rate">Frete padrão<input type="number" min="0" step="0.01" value={form.shippingFlat} onChange={(event) => field("shippingFlat", Number(event.target.value))} /><small>Usado somente quando a cotação pelo CEP estiver desativada.</small></label>
        </section>

        <section className="shipping-rule-section shipping-free-rule full">
          <header><span>3</span><div><strong>Regra de frete grátis</strong><p>Ative a condição e informe o valor mínimo do pedido. Esta regra afeta o cálculo no checkout.</p></div></header>
          <label className={`shipping-option-card shipping-option-wide ${form.freeShippingEnabled ? "active" : ""}`}>
            <input type="checkbox" checked={form.freeShippingEnabled} onChange={(event) => field("freeShippingEnabled", event.target.checked)} />
            <BadgePercent /><span><strong>Oferecer frete grátis por valor mínimo</strong><small>{form.freeShippingEnabled ? "A regra está ativa e será aplicada automaticamente." : "A regra está desativada e nenhum pedido recebe o benefício automaticamente."}</small></span>
          </label>
          <label className="shipping-rule-field shipping-threshold-field">Valor mínimo do pedido<input type="number" min="0" step="0.01" value={form.freeShippingThreshold} onChange={(event) => field("freeShippingThreshold", Number(event.target.value))} disabled={!form.freeShippingEnabled} /></label>
          <div className={`shipping-free-summary ${form.freeShippingEnabled ? "active" : ""}`}><Truck /><div><small>RESULTADO NO CHECKOUT</small><strong>{form.freeShippingEnabled ? `Pedidos a partir de ${formatMoney(form.freeShippingThreshold)} recebem frete grátis.` : "Frete grátis automático desativado."}</strong></div></div>
        </section>

        <section className="shipping-checkout-summary full">
          <header><div><small>RESUMO</small><strong>Como o checkout está configurado</strong></div><span>{form.shippingCityRates.length} {form.shippingCityRates.length === 1 ? "cidade" : "cidades"}</span></header>
          <div>
            {form.shippingCityRates.map((rate) => <span key={`${rate.city}-${rate.state}`}><MapPin /><b>{rate.city || "Cidade"}</b><strong>{formatMoney(rate.amount)}</strong></span>)}
            {form.localPickupEnabled && <span><Store /><b>Retirada no local</b><strong>Sem frete</strong></span>}
            {form.quoteShippingOutsideCities && <span><PackageCheck /><b>Demais cidades</b><strong>Cotação pelo CEP</strong></span>}
          </div>
        </section>

        <div className="settings-campaign-redirect full">
          <span><Paintbrush /></span>
          <div><small>DIVULGAÇÃO NA LOJA</small><strong>Quer mostrar essa condição na página inicial?</strong><p>Texto, botão, aparência e exibição da campanha são configurados no Editor da loja. A regra do checkout continua sendo definida aqui.</p></div>
          <Link className="admin-button" href="/admin/layout">Editar campanha <ArrowRight /></Link>
        </div>
      </div>
    </AdminPanel>
    <AdminPanel title="Conversão pelo WhatsApp" description="Defina como o carrinho é transformado em atendimento comercial.">
      <div className="admin-form settings-form"><div className="admin-form-section full"><MessageCircle /><div><strong>Checkout conectado ao WhatsApp</strong><span>Todo pedido é registrado e enviado ao número oficial configurado em Operação da loja.</span></div></div><div className="admin-form-section full"><MessageCircle /><div><strong>{formatWhatsappDisplay(form.whatsapp)}</strong><span>Destino atual da finalização. Para alterar, edite o campo WhatsApp acima e salve as configurações.</span></div></div><label className="full">Modelo da mensagem<textarea rows={14} value={form.whatsappMessage} onChange={(event) => field("whatsappMessage", event.target.value)} /></label><div className="admin-form-section full"><div><strong>Variáveis disponíveis</strong><span>{"{{loja}}, {{pedido}}, {{cliente}}, {{itens}}, {{total}}, {{rotulo_total}}, {{frete}}, {{desconto}}, {{percentual_desconto}}, {{pagamento}} e {{cupom}}"}</span></div></div></div>
    </AdminPanel>
    {error && <p className="admin-form-error settings-save-error">{error}</p>}
    <div className="settings-save-bar"><div><strong>Configuração da loja</strong><span>As mudanças aparecem na vitrine assim que forem salvas.</span></div><button className="admin-button primary">Salvar configurações</button></div>
  </form>;
}
