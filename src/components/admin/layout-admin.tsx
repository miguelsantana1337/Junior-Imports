"use client";

import {
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  ImagePlus,
  LayoutGrid,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { slugify } from "@/lib/format";
import { pageBlockSchema, storePageSchema } from "@/lib/validation";
import type { PageBlock, PageBlockKind, StorePage } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import { useConfirm } from "@/components/providers/confirm-provider";

const blockKinds: Array<{ value: PageBlockKind; label: string; description: string }> = [
  { value: "hero", label: "Banners rotativos", description: "Usa os banners configurados na loja." },
  { value: "trust", label: "Faixa de confiança", description: "Exibe os benefícios rápidos abaixo do cabeçalho." },
  { value: "featured", label: "Produtos em destaque", description: "Grade com os produtos marcados como destaque." },
  { value: "catalog", label: "Catálogo completo", description: "Busca, filtros e todos os produtos ativos." },
  { value: "promo", label: "Campanha promocional", description: "Chamada ampla usando o conteúdo promocional da home." },
  { value: "benefits", label: "Benefícios", description: "Cards de benefícios cadastrados na loja." },
  { value: "faq", label: "Dúvidas frequentes", description: "Lista de perguntas e respostas." },
  { value: "text", label: "Texto livre", description: "Container editorial com título, texto e botão opcionais." },
  { value: "image", label: "Imagem", description: "Container visual de largura configurável." },
  { value: "cta", label: "Chamada para ação", description: "Bloco de conversão com título, texto e botão." },
  { value: "spacer", label: "Espaçamento", description: "Cria respiro visual entre outros containers." },
];

export function LayoutAdmin() {
  const { data, deletePage, savePageBlock, deletePageBlock, movePageBlock } = useAdminData();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const pages = useMemo(() => [...data.pages].sort((a, b) => a.order - b.order), [data.pages]);
  const [selectedId, setSelectedId] = useState(pages[0]?.id ?? "home");
  const [pageEditor, setPageEditor] = useState<StorePage | "new" | null>(null);
  const [blockEditor, setBlockEditor] = useState<PageBlock | "new" | null>(null);
  const selectedPage = pages.find((page) => page.id === selectedId) ?? pages[0];
  const blocks = useMemo(
    () => data.pageBlocks.filter((block) => block.pageId === selectedPage?.id).sort((a, b) => a.order - b.order),
    [data.pageBlocks, selectedPage?.id],
  );

  useEffect(() => {
    if (searchParams.get("novo") === "pagina") setPageEditor("new");
  }, [searchParams]);

  useEffect(() => {
    if (!pages.some((page) => page.id === selectedId) && pages[0]) setSelectedId(pages[0].id);
  }, [pages, selectedId]);

  if (!selectedPage) return null;

  return (
    <>
      <div className="layout-builder-intro">
        <div><LayoutGrid /><div><strong>Construtor modular</strong><span>Crie páginas e combine containers sem alterar o código.</span></div></div>
        <Link className="admin-button" href={selectedPage.isHome ? "/" : `/paginas/${selectedPage.slug}`} target="_blank">Visualizar página <ChevronRight /></Link>
      </div>
      <div className="layout-builder-grid">
        <AdminPanel title="Páginas" description="Gerencie páginas, links do menu e publicação." action={<button className="admin-button primary" onClick={() => setPageEditor("new")}><FilePlus2 /> Nova página</button>}>
          <div className="layout-page-list">
            {pages.map((page) => (
              <article className={page.id === selectedPage.id ? "active" : ""} key={page.id}>
                <button className="layout-page-select" onClick={() => setSelectedId(page.id)}>
                  <span>{page.isHome ? "INÍCIO" : "PÁGINA"}</span>
                  <strong>{page.name}</strong>
                  <small>/{page.isHome ? "" : `paginas/${page.slug}`} · {data.pageBlocks.filter((block) => block.pageId === page.id).length} containers</small>
                </button>
                <div className="admin-actions">
                  <button title="Editar página" onClick={() => setPageEditor(page)}><Pencil /></button>
                  {!page.isHome && <button className="danger" title="Excluir página" onClick={async () => { const accepted = await confirm({ title: "Excluir página?", description: `A página “${page.name}” e todos os containers dela serão removidos.`, confirmLabel: "Excluir página", danger: true }); if (accepted) await deletePage(page.id); }}><Trash2 /></button>}
                </div>
              </article>
            ))}
          </div>
        </AdminPanel>

        <AdminPanel title={`Containers · ${selectedPage.name}`} description="Reordene, duplique, edite ou oculte cada parte da página." action={<button className="admin-button primary" onClick={() => setBlockEditor("new")}><Plus /> Novo container</button>}>
          <div className="layout-block-list">
            {blocks.map((block, index) => {
              const kind = blockKinds.find((item) => item.value === block.kind);
              return (
                <article key={block.id}>
                  <div className="order-buttons"><button disabled={index === 0} onClick={() => movePageBlock(selectedPage.id, block.id, -1)}>↑</button><button disabled={index === blocks.length - 1} onClick={() => movePageBlock(selectedPage.id, block.id, 1)}>↓</button></div>
                  <span className="layout-block-icon"><LayoutGrid /></span>
                  <div className="sortable-main"><strong>{block.name}</strong><small>{kind?.label} · {block.containerWidth} · <StatusTag active={block.active}>{block.active ? "Visível" : "Oculto"}</StatusTag></small></div>
                  <div className="admin-actions">
                    <button title={block.active ? "Ocultar" : "Exibir"} onClick={() => savePageBlock({ ...block, active: !block.active })}>{block.active ? <EyeOff /> : <Eye />}</button>
                    <button title="Duplicar" onClick={() => savePageBlock({ ...block, id: crypto.randomUUID(), name: `${block.name} (cópia)`, order: blocks.length + 1 })}><Copy /></button>
                    <button title="Editar" onClick={() => setBlockEditor(block)}><Pencil /></button>
                    <button className="danger" title="Excluir" onClick={async () => { const accepted = await confirm({ title: "Excluir container?", description: `O container “${block.name}” será removido desta página.`, confirmLabel: "Excluir container", danger: true }); if (accepted) await deletePageBlock(block.id); }}><Trash2 /></button>
                  </div>
                </article>
              );
            })}
            {!blocks.length && <div className="layout-empty"><LayoutGrid /><strong>Esta página ainda está vazia.</strong><p>Adicione o primeiro container para começar a montar o layout.</p><button className="admin-button primary" onClick={() => setBlockEditor("new")}><Plus /> Adicionar container</button></div>}
          </div>
        </AdminPanel>
      </div>
      {pageEditor && <PageEditor page={pageEditor === "new" ? null : pageEditor} pages={pages} onSaved={(id) => { setSelectedId(id); setPageEditor(null); }} onClose={() => setPageEditor(null)} />}
      {blockEditor && <BlockEditor block={blockEditor === "new" ? null : blockEditor} page={selectedPage} blockCount={blocks.length} onClose={() => setBlockEditor(null)} />}
    </>
  );
}

function PageEditor({ page, pages, onSaved, onClose }: { page: StorePage | null; pages: StorePage[]; onSaved: (id: string) => void; onClose: () => void }) {
  const { savePage } = useAdminData();
  const [form, setForm] = useState<StorePage>(page ?? { id: crypto.randomUUID(), name: "Nova página", slug: "nova-pagina", title: "Nova página", description: "", active: true, showInNavigation: true, isHome: false, order: pages.length + 1 });
  const [error, setError] = useState("");
  function field<K extends keyof StorePage>(key: K, value: StorePage[K]) { setForm((current) => ({ ...current, [key]: value })); }
  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="page-editor-title"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel small"><header><div><span>EDITOR DA LOJA</span><h2 id="page-editor-title">{page ? "Editar página" : "Nova página"}</h2></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><form className="admin-form" onSubmit={async (event) => { event.preventDefault(); const parsed = storePageSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } if (pages.some((item) => item.slug === form.slug && item.id !== form.id)) { setError("Já existe uma página com este endereço."); return; } await savePage(form); onSaved(form.id); }}><label>Nome interno<input value={form.name} onChange={(event) => { field("name", event.target.value); if (!page) field("slug", slugify(event.target.value)); }} /></label><label>Endereço da página<input value={form.slug} disabled={form.isHome} onChange={(event) => field("slug", slugify(event.target.value))} /></label><label className="full">Título público<input value={form.title} onChange={(event) => field("title", event.target.value)} /></label><label className="full">Descrição da prévia do link<textarea value={form.description} onChange={(event) => field("description", event.target.value)} /></label><label className="check-field"><input type="checkbox" checked={form.active} disabled={form.isHome} onChange={(event) => field("active", event.target.checked)} /> Página publicada</label><label className="check-field"><input type="checkbox" checked={form.showInNavigation} disabled={form.isHome} onChange={(event) => field("showInNavigation", event.target.checked)} /> Mostrar no menu da loja</label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary">Salvar página</button></div></form></div></div>;
}

function BlockEditor({ block, page, blockCount, onClose }: { block: PageBlock | null; page: StorePage; blockCount: number; onClose: () => void }) {
  const { savePageBlock, uploadMedia } = useAdminData();
  const [form, setForm] = useState<PageBlock>(block ?? { id: crypto.randomUUID(), pageId: page.id, kind: "text", name: "Novo container", eyebrow: "NOVA SEÇÃO", title: "Título do container", body: "Escreva aqui o conteúdo desta seção.", buttonText: "", buttonLink: "", imageUrl: "", backgroundColor: "", textColor: "", containerWidth: "normal", padding: "medium", columns: 1, active: true, order: blockCount + 1 });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const isSystemBlock = ["hero", "trust"].includes(form.kind);
  function field<K extends keyof PageBlock>(key: K, value: PageBlock[K]) { setForm((current) => ({ ...current, [key]: value })); }
  return <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="block-editor-title"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel"><header><div><span>CONTAINER</span><h2 id="block-editor-title">{block ? "Editar container" : "Novo container"}</h2><small>{page.name}</small></div><button onClick={onClose} aria-label="Fechar"><X /></button></header><form className="admin-form" onSubmit={async (event) => { event.preventDefault(); const parsed = pageBlockSchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await savePageBlock(form); onClose(); }}><label>Tipo de conteúdo<select value={form.kind} onChange={(event) => { const kind = event.target.value as PageBlockKind; const metadata = blockKinds.find((item) => item.value === kind); setForm((current) => ({ ...current, kind, name: block ? current.name : metadata?.label ?? current.name })); }}>{blockKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select><small className="field-hint">{blockKinds.find((item) => item.value === form.kind)?.description}</small></label><label>Nome interno<input value={form.name} onChange={(event) => field("name", event.target.value)} /></label>{!isSystemBlock && form.kind !== "spacer" && <><label>Chamada superior<input value={form.eyebrow} onChange={(event) => field("eyebrow", event.target.value)} /></label><label className="full">Título<input value={form.title} onChange={(event) => field("title", event.target.value)} /></label><label className="full">Texto<textarea value={form.body} onChange={(event) => field("body", event.target.value)} /></label><label>Texto do botão<input value={form.buttonText} onChange={(event) => field("buttonText", event.target.value)} /></label><label>Link do botão<input value={form.buttonLink} onChange={(event) => field("buttonLink", event.target.value)} /></label></>}{form.kind === "image" && <><label className="full">URL da imagem<input value={form.imageUrl} onChange={(event) => field("imageUrl", event.target.value)} /></label><label className="full upload-label"><ImagePlus /> {uploading ? "Enviando..." : "Enviar imagem"}<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { field("imageUrl", await uploadMedia(file, "site-media")); } finally { setUploading(false); } }} /></label></>}<div className="admin-form-section full"><strong>Aparência do container</strong><span>Personalize largura, respiro e cores sem alterar o tema global.</span></div><label>Largura<select value={form.containerWidth} onChange={(event) => field("containerWidth", event.target.value as PageBlock["containerWidth"])}><option value="narrow">Estreita</option><option value="normal">Padrão</option><option value="wide">Ampla</option><option value="full">Tela inteira</option></select></label><label>Espaçamento<select value={form.padding} onChange={(event) => field("padding", event.target.value as PageBlock["padding"])}><option value="none">Sem espaço</option><option value="small">Pequeno</option><option value="medium">Médio</option><option value="large">Grande</option></select></label><label>Cor de fundo<input type="color" value={form.backgroundColor || "#07090d"} onChange={(event) => field("backgroundColor", event.target.value)} /></label><label>Cor do texto<input type="color" value={form.textColor || "#f5f7fb"} onChange={(event) => field("textColor", event.target.value)} /></label><label>Colunas<input type="number" min="1" max="4" value={form.columns} onChange={(event) => field("columns", Number(event.target.value))} /></label><label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Container visível</label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary">Salvar container</button></div></form></div></div>;
}
