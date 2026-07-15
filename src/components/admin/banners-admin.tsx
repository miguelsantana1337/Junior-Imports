"use client";

import {
  Eye,
  EyeOff,
  ImagePlus,
  Monitor,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { bannerSchema } from "@/lib/validation";
import type { Banner } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";

export function BannersAdmin() {
  const { data, deleteBanner, moveItem, toggleItem } = useAdminData();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Banner | "new" | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("novo") === "1") setEditing("new");
  }, [searchParams]);

  const banners = [...data.banners].sort((a, b) => a.order - b.order);

  return (
    <>
      <section className="banner-guidance" aria-labelledby="banner-guidance-title">
        <div>
          <span>BANNERS QUE FUNCIONAM EM QUALQUER TELA</span>
          <h2 id="banner-guidance-title">Use uma arte para desktop e outra para celular.</h2>
          <p>Assim o conteúdo importante não fica cortado e a primeira dobra carrega com aparência profissional.</p>
        </div>
        <article><Monitor /><div><strong>Desktop · 1920 × 800 px</strong><small>Proporção 12:5 · mantenha textos a 10% das bordas.</small></div></article>
        <article><Smartphone /><div><strong>Mobile · 1080 × 1350 px</strong><small>Proporção 4:5 · enquadramento central e leitura rápida.</small></div></article>
        <small className="banner-guidance-format">WebP ou JPG · preferencialmente até 1 MB</small>
      </section>

      <AdminPanel
        title="Banners rotativos"
        description="Organize as campanhas, acompanhe a visibilidade e abra a edição para conferir as prévias."
        action={<button className="admin-button primary" onClick={() => setEditing("new")}><Plus /> Adicionar banner</button>}
      >
        <div className="admin-list banner-admin-list">
          {banners.map((banner, index) => (
            <article className="sortable-row" key={banner.id}>
              <div className="order-buttons">
                <button disabled={index === 0} onClick={() => moveItem("banners", banner.id, -1)} aria-label={`Mover ${banner.title || "banner"} para cima`}>↑</button>
                <button disabled={index === banners.length - 1} onClick={() => moveItem("banners", banner.id, 1)} aria-label={`Mover ${banner.title || "banner"} para baixo`}>↓</button>
              </div>
              <div
                className="banner-thumb"
                style={{
                  backgroundImage: banner.imageUrl ? `url(${banner.imageUrl})` : undefined,
                  background: banner.imageUrl ? undefined : `linear-gradient(120deg, ${banner.startColor}, ${banner.endColor})`,
                }}
                aria-hidden="true"
              />
              <div className="sortable-main">
                <strong>{banner.imageOnly ? banner.altText || "Banner somente imagem" : banner.title}</strong>
                <small>
                  {banner.imageOnly ? "Somente imagem" : "Imagem com conteúdo"} · {banner.mobileImageUrl ? "Desktop + mobile" : "Uma arte"} · Posição {banner.order} ·{" "}
                  <StatusTag active={banner.active}>{banner.active ? "Visível" : "Oculto"}</StatusTag>
                </small>
              </div>
              <div className="admin-actions">
                <button onClick={() => toggleItem("banners", banner.id)} aria-label={banner.active ? "Ocultar banner" : "Exibir banner"} title={banner.active ? "Ocultar" : "Exibir"}>{banner.active ? <EyeOff /> : <Eye />}</button>
                <button onClick={() => setEditing(banner)} aria-label="Editar banner" title="Editar"><Pencil /></button>
                <button
                  className="danger"
                  aria-label="Excluir banner"
                  title="Excluir"
                  onClick={async () => {
                    const accepted = await confirm({
                      title: "Excluir banner?",
                      description: "O banner será removido permanentemente da vitrine.",
                      confirmLabel: "Excluir banner",
                      danger: true,
                    });
                    if (accepted) await deleteBanner(banner.id);
                  }}
                ><Trash2 /></button>
              </div>
            </article>
          ))}
          {!banners.length && (
            <div className="admin-empty">
              <ImagePlus />
              <strong>Nenhum banner cadastrado.</strong>
              <span>Adicione a primeira campanha para ocupar o topo da loja.</span>
              <button className="admin-button primary" onClick={() => setEditing("new")}>Criar primeiro banner</button>
            </div>
          )}
        </div>
      </AdminPanel>

      {editing && <BannerEditor banner={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function BannerEditor({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const { data, saveBanner, uploadMedia } = useAdminData();
  const [form, setForm] = useState<Banner>(banner ?? {
    id: crypto.randomUUID(),
    kicker: "NOVA CAMPANHA",
    title: "Título claro para a campanha.",
    highlight: "campanha.",
    subtitle: "Explique a condição de forma breve e transparente.",
    buttonText: "Ver catálogo",
    buttonLink: "#catalogo",
    startColor: "#07101f",
    endColor: "#1677ff",
    imageUrl: "",
    mobileImageUrl: "",
    altText: "",
    imageOnly: false,
    active: true,
    order: data.banners.length + 1,
  });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState<"desktop" | "mobile" | null>(null);

  function field<K extends keyof Banner>(key: K, value: Banner[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
  }

  async function upload(file: File, target: "desktop" | "mobile") {
    setUploading(target);
    setError("");
    try {
      const url = await uploadMedia(file, "banner-media");
      field(target === "desktop" ? "imageUrl" : "mobileImageUrl", url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar a imagem.");
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = bannerSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os campos.");
      return;
    }
    await saveBanner(form);
    onClose();
  }

  const previewStyle = (imageUrl: string) => ({
    "--banner-start": form.startColor,
    "--banner-end": form.endColor,
    backgroundImage: imageUrl ? `linear-gradient(90deg, rgb(3 9 20 / 82%), rgb(3 9 20 / 18%)), url(${imageUrl})` : undefined,
  } as React.CSSProperties);

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="banner-editor-title">
      <button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" />
      <div className="admin-modal-panel banner-editor-panel">
        <header>
          <div><span>BANNERS</span><h2 id="banner-editor-title">{banner ? "Editar banner" : "Novo banner"}</h2><small>Configure o conteúdo e confira como ficará em cada tela.</small></div>
          <button onClick={onClose} aria-label="Fechar"><X /></button>
        </header>

        <form className="admin-form banner-editor-form" onSubmit={submit}>
          <div className="banner-mode-choice full">
            <label><input type="radio" name="banner-mode" checked={!form.imageOnly} onChange={() => field("imageOnly", false)} /><span><strong>Imagem com conteúdo</strong><small>Título, texto e botão sobre a arte.</small></span></label>
            <label><input type="radio" name="banner-mode" checked={form.imageOnly} onChange={() => field("imageOnly", true)} /><span><strong>Somente imagem</strong><small>A arte pronta ocupa todo o banner.</small></span></label>
          </div>

          <div className="banner-upload-grid full">
            <ImageUploadCard
              icon={<Monitor />}
              title="Imagem desktop"
              hint="1920 × 800 px · 12:5"
              value={form.imageUrl}
              loading={uploading === "desktop"}
              onUrl={(value) => field("imageUrl", value)}
              onFile={(file) => upload(file, "desktop")}
            />
            <ImageUploadCard
              icon={<Smartphone />}
              title="Imagem mobile"
              hint="1080 × 1350 px · 4:5"
              value={form.mobileImageUrl}
              loading={uploading === "mobile"}
              onUrl={(value) => field("mobileImageUrl", value)}
              onFile={(file) => upload(file, "mobile")}
            />
          </div>

          <label className="full">Descrição da imagem para acessibilidade<input value={form.altText} onChange={(event) => field("altText", event.target.value)} placeholder="Ex.: Necessaire azul em destaque sobre fundo claro" /><small>Descreva a imagem sem repetir “imagem de”.</small></label>

          {!form.imageOnly && (
            <>
              <label>Chamada superior<input value={form.kicker} onChange={(event) => field("kicker", event.target.value)} /></label>
              <label>Trecho destacado<input value={form.highlight} onChange={(event) => field("highlight", event.target.value)} /></label>
              <label className="full">Título<input value={form.title} onChange={(event) => field("title", event.target.value)} /></label>
              <label className="full">Subtítulo<textarea value={form.subtitle} onChange={(event) => field("subtitle", event.target.value)} /></label>
              <label>Texto do botão<input value={form.buttonText} onChange={(event) => field("buttonText", event.target.value)} /></label>
              <label>Link do botão<input value={form.buttonLink} onChange={(event) => field("buttonLink", event.target.value)} /></label>
              <label>Cor inicial<input type="color" value={form.startColor} onChange={(event) => field("startColor", event.target.value)} /></label>
              <label>Cor final<input type="color" value={form.endColor} onChange={(event) => field("endColor", event.target.value)} /></label>
            </>
          )}

          {form.imageOnly && <label className="full">Link ao clicar na imagem<input value={form.buttonLink} onChange={(event) => field("buttonLink", event.target.value)} placeholder="/#catalogo" /></label>}

          <div className="banner-responsive-preview full">
            <div>
              <span><Monitor /> Prévia desktop</span>
              <div className={`banner-preview desktop ${form.imageOnly ? "image-only" : ""}`} style={previewStyle(form.imageUrl)}>
                {!form.imageOnly && <div><small>{form.kicker}</small><strong>{form.title}</strong><p>{form.subtitle}</p><b>{form.buttonText}</b></div>}
              </div>
            </div>
            <div>
              <span><Smartphone /> Prévia mobile</span>
              <div className={`banner-preview mobile ${form.imageOnly ? "image-only" : ""}`} style={previewStyle(form.mobileImageUrl || form.imageUrl)}>
                {!form.imageOnly && <div><small>{form.kicker}</small><strong>{form.title}</strong><p>{form.subtitle}</p><b>{form.buttonText}</b></div>}
              </div>
            </div>
          </div>

          <label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Banner visível</label>
          {error && <p className="admin-form-error full" role="alert">{error}</p>}
          <div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" type="submit" disabled={Boolean(uploading)}>Salvar banner</button></div>
        </form>
      </div>
    </div>
  );
}

function ImageUploadCard({
  icon,
  title,
  hint,
  value,
  loading,
  onUrl,
  onFile,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  value: string;
  loading: boolean;
  onUrl: (value: string) => void;
  onFile: (file: File) => void;
}) {
  return (
    <section className="banner-upload-card">
      <header><span>{icon}</span><div><strong>{title}</strong><small>{hint}</small></div></header>
      <label className="admin-button"><ImagePlus /> {loading ? "Enviando..." : "Enviar imagem"}<input type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={loading} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.currentTarget.value = ""; }} /></label>
      <label>ou cole uma URL<input value={value} onChange={(event) => onUrl(event.target.value)} placeholder="https://..." /></label>
    </section>
  );
}
