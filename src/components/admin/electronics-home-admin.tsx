"use client";

import { ExternalLink, ImagePlus, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel } from "./admin-ui";
import { adminCatalogHref } from "@/lib/admin-catalog-link";
import { electronicsBannerKeys, electronicsHomeBlock, electronicsHomeKeys, electronicsHomePage, resolveElectronicsHome, type ElectronicsHomeKey } from "@/lib/electronics-home";
import { pageBlockSchema } from "@/lib/validation";
import type { PageBlock } from "@/types/store";

export function ElectronicsHomeAdmin() {
  const { data } = useAdminData();
  const content = resolveElectronicsHome(data.tenant.id, data.pageBlocks);
  return <div className="electronics-editor">
    <AdminPanel title="Home de eletrônicos" description="Os textos e a imagem desta área mudam somente a loja principal. O catálogo farmacêutico permanece separado." action={<Link className="admin-button" href={adminCatalogHref(data.tenant, "electronics")} target="_blank" rel="noreferrer"><ExternalLink /> Ver eletrônicos</Link>}>
      <div className="electronics-editor-help"><strong>Produtos, preços, fotos e estoque</strong><p>Edite em Produtos → Eletrônicos. Marque um produto como destaque para priorizá-lo no banner. Se não houver destaque, aparece o primeiro produto da ordem do catálogo.</p><Link className="admin-button" href="/admin/products?catalog=electronics">Gerenciar produtos eletrônicos</Link></div>
    </AdminPanel>
    <div className="electronics-editor-sections">{electronicsHomeKeys.map((key) => <ElectronicsSectionEditor key={key} sectionKey={key} block={content[key]} />)}</div>
  </div>;
}

function ElectronicsSectionEditor({ sectionKey, block }: { sectionKey: ElectronicsHomeKey; block: PageBlock }) {
  const { data, savePage, savePageBlock, uploadMedia } = useAdminData();
  const [form, setForm] = useState(block);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(JSON.stringify(block));
  useEffect(() => {
    if (!busy && JSON.stringify(form) === savedSnapshot && JSON.stringify(block) !== savedSnapshot) {
      setForm(block); setSavedSnapshot(JSON.stringify(block));
    }
  }, [block, busy, form, savedSnapshot]);
  const isRotatingBanner = electronicsBannerKeys.includes(sectionKey as (typeof electronicsBannerKeys)[number]);
  const isOptionalBanner = sectionKey === "banner-2" || sectionKey === "banner-3";
  const hasEyebrow = isRotatingBanner || ["catalog", "guide"].includes(sectionKey);
  const hasButton = isRotatingBanner || sectionKey === "announcement";
  const hasBody = sectionKey !== "announcement";
  function field<K extends keyof PageBlock>(key: K, value: PageBlock[K]) { setForm((current) => ({ ...current, [key]: value })); setError(""); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const fixed = electronicsHomeBlock(data.tenant.id, sectionKey);
    const candidate = { ...form, id: fixed.id, pageId: fixed.pageId, kind: fixed.kind, active: isOptionalBanner ? form.active : true };
    const result = pageBlockSchema.safeParse(candidate);
    if (!result.success) { setError(result.error.issues[0].message); return; }
    if (hasButton && !/^\/(?!\/)[^\\\s]*$/.test(form.buttonLink) && !/^#[a-zA-Z0-9_-]+$/.test(form.buttonLink)) {
      setError("Use um destino dentro da loja, como /#catalogo ou /#como-comprar."); return;
    }
    setBusy(true); setError("");
    try {
      if (!data.pages.some((page) => page.id === fixed.pageId)) await savePage(electronicsHomePage(data.tenant.id));
      await savePageBlock(candidate);
      setSavedSnapshot(JSON.stringify(candidate));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível salvar. Tente novamente."); }
    finally { setBusy(false); }
  }

  return <AdminPanel title={block.name} description={sectionKey === "hero" ? "Primeiro banner da vitrine. Sem imagem, ele usa a foto do produto em destaque." : isOptionalBanner ? "Banner adicional do carrossel mobile. Ative somente quando o conteúdo estiver pronto." : "Salve esta seção para atualizar os eletrônicos."}>
    <form className="admin-form electronics-section-form" onSubmit={(event) => void save(event)}>
      {isOptionalBanner && <label className="full check-field"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Exibir no carrossel mobile</label>}
      {hasEyebrow && <label className="full">Chamada superior<input value={form.eyebrow} maxLength={80} onChange={(event) => field("eyebrow", event.target.value)} /></label>}
      {sectionKey !== "footer" && <label className="full">{sectionKey === "announcement" ? "Texto da barra" : "Título"}<textarea value={form.title} maxLength={160} rows={2} required onChange={(event) => field("title", event.target.value)} />{sectionKey === "hero" && <small>Use uma quebra de linha para destacar a segunda parte do título.</small>}</label>}
      {hasBody && <label className="full">{sectionKey === "footer" ? "Descrição do rodapé" : "Descrição"}<textarea value={form.body} maxLength={1200} rows={3} onChange={(event) => field("body", event.target.value)} /></label>}
      {hasButton && <><label>Texto do botão<input value={form.buttonText} required maxLength={60} onChange={(event) => field("buttonText", event.target.value)} /></label><label>Destino dentro da loja<input value={form.buttonLink} required maxLength={300} onChange={(event) => field("buttonLink", event.target.value)} /><small>Ex.: /#catalogo ou /#como-comprar</small></label></>}
      {sectionKey === "catalog" && <label>Colunas no computador<select value={form.columns} onChange={(event) => field("columns", Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select><small>No celular, a grade se adapta automaticamente.</small></label>}
      {isRotatingBanner && <div className="full electronics-editor-image"><label>Imagem do banner (opcional)<input type="url" value={form.imageUrl} placeholder="https://..." onChange={(event) => field("imageUrl", event.target.value)} /></label><label className="admin-button"><ImagePlus /> {busy ? "Aguarde…" : "Enviar imagem"}<input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); setError(""); try { field("imageUrl", await uploadMedia(file, "banner-media")); } catch (caught) { setError(caught instanceof Error ? caught.message : "Não foi possível enviar a imagem."); } finally { setBusy(false); } }} /></label><small>Para o celular, prefira 1080 × 1350 px (4:5). No primeiro banner, deixe vazio para usar a foto do produto em destaque.</small></div>}
      {error && <p className="full" role="alert">{error}</p>}
      <div className="admin-form-actions full"><button className="admin-button primary" type="submit" disabled={busy || JSON.stringify(form) === savedSnapshot}><Save /> {busy ? "Salvando…" : "Salvar seção"}</button></div>
    </form>
  </AdminPanel>;
}
