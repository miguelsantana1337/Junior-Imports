"use client";

import {
  ArrowDown,
  ArrowUp,
  BadgePercent,
  BookOpenText,
  ChevronRight,
  CircleHelp,
  Copy,
  Eye,
  EyeOff,
  FilePlus2,
  GalleryHorizontalEnd,
  GripVertical,
  Heading,
  ImagePlus,
  Images,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  Megaphone,
  MoreHorizontal,
  MousePointerClick,
  Paintbrush,
  PackageSearch,
  Pencil,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { slugify } from "@/lib/format";
import { resolveStoreAnnouncement } from "@/lib/store-announcement";
import { legacyFaqDraft } from "@/lib/storefront-commerce";
import { pageBlockSchema, storePageSchema } from "@/lib/validation";
import type { Benefit, Faq, HomeSection, PageBlock, PageBlockKind, StorePage, StoreSettings, TrustItem } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { adminCatalogHref, hasSeparateCatalogs } from "@/lib/admin-catalog-link";
import { AdminPanel, StatusTag } from "./admin-ui";
import { useConfirm } from "@/components/providers/confirm-provider";

const blockKinds: Array<{ value: PageBlockKind; label: string; description: string }> = [
  { value: "hero", label: "Banners rotativos", description: "Escolha os banners visíveis e o tempo de troca." },
  { value: "trust", label: "Faixa de confiança", description: "Edite os benefícios rápidos exibidos abaixo do cabeçalho." },
  { value: "featured", label: "Produtos em destaque", description: "Escolha exatamente quais produtos aparecem na grade." },
  { value: "catalog", label: "Catálogo completo", description: "Escolha as categorias disponíveis no catálogo da loja." },
  { value: "promo", label: "Campanha promocional", description: "Crie uma chamada promocional com texto e botão próprios." },
  { value: "benefits", label: "Benefícios", description: "Edite, adicione, remova e ordene os cards de benefícios." },
  { value: "faq", label: "Dúvidas frequentes", description: "Edite, adicione, remova e ordene perguntas e respostas." },
  { value: "text", label: "Texto livre", description: "Container editorial com título, texto e botão opcionais." },
  { value: "image", label: "Imagem", description: "Container visual de largura configurável." },
  { value: "cta", label: "Chamada para ação", description: "Bloco de conversão com título, texto e botão." },
  { value: "spacer", label: "Espaçamento", description: "Cria respiro visual entre outros containers." },
];

const resourceBlockKinds: PageBlockKind[] = ["hero", "trust", "featured", "catalog", "benefits", "faq"];

function BlockKindIcon({ kind }: { kind: PageBlockKind }) {
  const icons: Record<PageBlockKind, typeof LayoutGrid> = {
    hero: Images,
    trust: ShieldCheck,
    featured: PackageSearch,
    catalog: LayoutDashboard,
    promo: BadgePercent,
    benefits: ListChecks,
    faq: CircleHelp,
    text: Heading,
    image: ImagePlus,
    cta: MousePointerClick,
    spacer: GripVertical,
  };
  const Icon = icons[kind];
  return <Icon aria-hidden="true" />;
}

function resolveBlockContent(block: PageBlock, sections: HomeSection[], settings: StoreSettings): PageBlock {
  const legacySection = sections.find((section) => section.kind === block.kind);
  const fallback = block.kind === "promo"
    ? {
        eyebrow: settings.freeShippingBannerEyebrow,
        title: settings.freeShippingBannerTitle,
        body: settings.freeShippingBannerSubtitle,
        buttonText: settings.freeShippingBannerButtonText,
        buttonLink: settings.freeShippingBannerButtonLink,
      }
    : {
        eyebrow: legacySection?.eyebrow ?? "",
        title: legacySection?.title ?? "",
        body: legacySection?.subtitle ?? "",
        buttonText: legacySection?.buttonText ?? "",
        buttonLink: legacySection?.buttonLink ?? "",
      };

  return {
    ...block,
    eyebrow: block.eyebrow || fallback.eyebrow,
    title: block.title || fallback.title,
    body: block.body || fallback.body,
    buttonText: block.buttonText || fallback.buttonText,
    buttonLink: block.buttonLink || fallback.buttonLink,
  };
}

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
        <div className="layout-builder-intro-copy"><Sparkles /><div><strong>{hasSeparateCatalogs(data.tenant) ? "Editor do catálogo farmacêutico" : "Tudo da loja em um único editor"}</strong><span>{hasSeparateCatalogs(data.tenant) ? "Edite a home, banners e páginas do catálogo farmacêutico. A loja principal de eletrônicos tem apresentação própria." : "Edite a página inicial, páginas institucionais, ordem das seções, textos e itens exibidos."}</span></div></div>
        <div className="layout-builder-steps" aria-label="Etapas do editor">
          <span><b>1</b> Página</span>
          <ChevronRight aria-hidden="true" />
          <span><b>2</b> Organização</span>
          <ChevronRight aria-hidden="true" />
          <span><b>3</b> Conteúdo</span>
        </div>
        <div className="layout-builder-actions">
          <Link className="admin-button" href="/admin/banners"><Images /> Biblioteca de banners</Link>
          <Link className="admin-button" href={adminCatalogHref(data.tenant, "pharmaceutical", selectedPage.isHome ? "/" : `/paginas/${selectedPage.slug}`)} target="_blank">{hasSeparateCatalogs(data.tenant) ? "Ver no catálogo farmacêutico" : "Ver resultado na loja"} <ChevronRight /></Link>
        </div>
      </div>
      <AnnouncementEditor />
      <section className="layout-page-workspace" aria-labelledby="layout-page-workspace-title">
        <div className="layout-page-workspace-heading">
          <div><span>PASSO 1</span><h2 id="layout-page-workspace-title">Qual página você quer editar?</h2><p>A página selecionada fica destacada abaixo.</p></div>
          <button className="admin-button" onClick={() => setPageEditor("new")}><FilePlus2 /> Criar nova página</button>
        </div>
        <div className="layout-page-tabs">
          {pages.map((page) => {
            const pageBlockCount = data.pageBlocks.filter((block) => block.pageId === page.id).length;
            return (
              <article className={page.id === selectedPage.id ? "active" : ""} key={page.id}>
                <button className="layout-page-select" onClick={() => setSelectedId(page.id)} aria-pressed={page.id === selectedPage.id}>
                  <span>{page.isHome ? "PÁGINA PRINCIPAL" : "PÁGINA INSTITUCIONAL"}</span>
                  <strong>{page.name}</strong>
                  <small>{pageBlockCount} {pageBlockCount === 1 ? "seção" : "seções"} · /{page.isHome ? "" : `paginas/${page.slug}`}</small>
                </button>
                <div className="admin-actions">
                  <button title="Configurar página" aria-label={`Configurar página ${page.name}`} onClick={() => setPageEditor(page)}><Settings2 /></button>
                  {!page.isHome && <button className="danger" title="Excluir página" aria-label={`Excluir página ${page.name}`} onClick={async () => { const accepted = await confirm({ title: "Excluir página?", description: `A página “${page.name}” e todas as seções dela serão removidas.`, confirmLabel: "Excluir página", danger: true }); if (accepted) await deletePage(page.id); }}><Trash2 /></button>}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <div className="layout-sections-workspace">
        <AdminPanel title={`Seções de “${selectedPage.name}”`} description="Cada cartão representa uma parte da página. Use as setas para mudar a ordem." action={<button className="admin-button primary" onClick={() => setBlockEditor("new")}><Plus /> Adicionar seção</button>}>
          <div className="layout-section-guide"><span>PASSO 2</span><strong>Organize de cima para baixo</strong><p>A primeira seção da lista aparece primeiro na loja.</p></div>
          <div className="layout-block-list">
            {blocks.map((block, index) => {
              const kind = blockKinds.find((item) => item.value === block.kind);
              const widthLabel = { narrow: "largura estreita", normal: "largura padrão", wide: "largura ampla", full: "tela inteira" }[block.containerWidth];
              const contentSummary = block.kind === "hero" ? `${data.banners.filter((item) => item.active).length} banners`
                : block.kind === "featured" ? `${data.products.filter((item) => item.active && item.featured).length} produtos`
                  : block.kind === "catalog" ? `${data.categories.filter((item) => item.active).length} categorias`
                    : block.kind === "trust" ? `${data.trustItems.length} itens`
                      : block.kind === "benefits" ? `${data.benefits.length} cards`
                        : block.kind === "faq" ? `${data.faqs.length} perguntas`
                          : widthLabel;
              return (
                <article className={`layout-section-card kind-${block.kind}`} key={block.id}>
                  <div className="layout-section-order" aria-label={`Ordem da seção: ${index + 1}`}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <div><button aria-label={`Mover ${block.name} para cima`} disabled={index === 0} onClick={() => movePageBlock(selectedPage.id, block.id, -1)}><ArrowUp /></button><button aria-label={`Mover ${block.name} para baixo`} disabled={index === blocks.length - 1} onClick={() => movePageBlock(selectedPage.id, block.id, 1)}><ArrowDown /></button></div>
                  </div>
                  <span className="layout-block-icon"><BlockKindIcon kind={block.kind} /></span>
                  <div className="layout-section-main"><span>{kind?.label}</span><strong>{block.name}</strong><small>{contentSummary}</small></div>
                  <button className={`layout-visibility-button ${block.active ? "active" : ""}`} title={block.active ? "Ocultar da loja" : "Mostrar na loja"} onClick={() => savePageBlock({ ...block, active: !block.active })}>{block.active ? <Eye /> : <EyeOff />}<span>{block.active ? "Visível" : "Oculta"}</span></button>
                  <button className="admin-button layout-edit-section" onClick={() => setBlockEditor(block)}><Pencil /> Editar conteúdo</button>
                  <details className="layout-block-menu">
                    <summary aria-label={`Mais ações para ${block.name}`}><MoreHorizontal /></summary>
                    <div>
                      <button onClick={() => savePageBlock({ ...block, id: crypto.randomUUID(), name: `${block.name} (cópia)`, order: blocks.length + 1 })}><Copy /> Duplicar seção</button>
                      <button className="danger" onClick={async () => { const accepted = await confirm({ title: "Excluir seção?", description: `A seção “${block.name}” será removida desta página.`, confirmLabel: "Excluir seção", danger: true }); if (accepted) await deletePageBlock(block.id); }}><Trash2 /> Excluir seção</button>
                    </div>
                  </details>
                </article>
              );
            })}
            {!blocks.length && <div className="layout-empty"><LayoutGrid /><strong>Esta página ainda está vazia.</strong><p>Adicione a primeira seção para começar a montar a loja.</p><button className="admin-button primary" onClick={() => setBlockEditor("new")}><Plus /> Adicionar primeira seção</button></div>}
          </div>
        </AdminPanel>
      </div>
      {pageEditor && <PageEditor page={pageEditor === "new" ? null : pageEditor} pages={pages} onSaved={(id) => { setSelectedId(id); setPageEditor(null); }} onClose={() => setPageEditor(null)} />}
      {blockEditor && <BlockEditor block={blockEditor === "new" ? null : blockEditor} page={selectedPage} blockCount={blocks.length} onClose={() => setBlockEditor(null)} />}
    </>
  );
}

function AnnouncementEditor() {
  const { data, saveSettings } = useAdminData();
  const [announcement, setAnnouncement] = useState(data.settings.announcement);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const preview = resolveStoreAnnouncement({ ...data.settings, announcement });
  const normalizedAnnouncement = announcement.trim();
  const hasChanges = normalizedAnnouncement !== data.settings.announcement;

  useEffect(() => {
    setAnnouncement(data.settings.announcement);
  }, [data.settings.announcement]);

  function insertVariable(variable: "{{valor}}" | "{{frete}}") {
    setAnnouncement((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}${variable}`.slice(0, 160));
  }

  return (
    <AdminPanel
      title="Aviso no topo da loja"
      description="Mensagem global exibida em todas as páginas."
      action={<StatusTag active>Publicado</StatusTag>}
    >
      <div className="announcement-editor-summary">
        <span className="announcement-summary-icon"><Megaphone aria-hidden="true" /></span>
        <div><span>MENSAGEM ATUAL</span><strong>{preview || "Nenhuma mensagem configurada"}</strong><small>Use para promoções, prazos e avisos importantes.</small></div>
        <button className="admin-button" type="button" onClick={() => setExpanded((current) => !current)}>{expanded ? <X /> : <Pencil />} {expanded ? "Fechar edição" : "Editar aviso"}</button>
      </div>
      {expanded &&
      <form
        className="announcement-editor"
        onSubmit={async (event) => {
          event.preventDefault();
          if (normalizedAnnouncement.length < 3) {
            setError("Digite uma mensagem com pelo menos 3 caracteres.");
            return;
          }
          setSaving(true);
          setError("");
          try {
            await saveSettings({ ...data.settings, announcement: normalizedAnnouncement });
          } catch (caughtError) {
            setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar a barra de anúncio.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="announcement-editor-fields">
          <label>
            Mensagem da barra
            <input
              value={announcement}
              maxLength={160}
              onChange={(event) => setAnnouncement(event.target.value)}
              placeholder="Ex.: Novidades chegaram · Confira as ofertas"
            />
            <small>{announcement.length}/160 caracteres</small>
          </label>
          <div className="announcement-variable-list" aria-label="Variáveis disponíveis">
            <span>Inserir automaticamente:</span>
            <button type="button" onClick={() => insertVariable("{{valor}}")}>{"{{valor}}"} · frete grátis</button>
            <button type="button" onClick={() => insertVariable("{{frete}}")}>{"{{frete}}"} · menor frete local</button>
          </div>
        </div>
        <div className="announcement-editor-preview" style={{ background: data.settings.primaryColor }}>
          <span>PRÉVIA NA LOJA</span>
          <div><strong>{preview || "Sua mensagem aparecerá aqui"}</strong><b>Ver ofertas →</b></div>
        </div>
        {error && <p className="admin-form-error">{error}</p>}
        <div className="announcement-editor-actions">
          <span>{hasChanges ? "Alteração ainda não publicada" : "Mensagem publicada na loja"}</span>
          <button className="admin-button primary" disabled={!hasChanges || saving}>
            <Save aria-hidden="true" /> {saving ? "Salvando..." : "Salvar barra"}
          </button>
        </div>
      </form>}
    </AdminPanel>
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
  const {
    data,
    savePageBlock,
    uploadMedia,
    saveSettings,
    saveFeaturedProducts,
    saveBannerVisibility,
    saveCategoryVisibility,
    saveTrustItems,
    saveBenefits,
    saveFaqs,
  } = useAdminData();
  const [form, setForm] = useState<PageBlock>(() => block
    ? resolveBlockContent(block, data.sections, data.settings)
    : { id: crypto.randomUUID(), pageId: page.id, kind: "text", name: "Nova seção", eyebrow: "NOVA SEÇÃO", title: "Título da seção", body: "Escreva aqui o conteúdo desta seção.", buttonText: "", buttonLink: "", imageUrl: "", backgroundColor: "", textColor: "", containerWidth: "normal", padding: "medium", columns: 1, active: true, order: blockCount + 1 });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resourceQuery, setResourceQuery] = useState("");
  const [featuredProductIds, setFeaturedProductIds] = useState(() => data.products.filter((product) => product.featured).map((product) => product.id));
  const [activeBannerIds, setActiveBannerIds] = useState(() => data.banners.filter((banner) => banner.active).map((banner) => banner.id));
  const [activeCategoryIds, setActiveCategoryIds] = useState(() => data.categories.filter((category) => category.active).map((category) => category.id));
  const [bannerSeconds, setBannerSeconds] = useState(data.settings.autoBannerSeconds);
  const [trustItems, setTrustItems] = useState(() => [...data.trustItems].sort((a, b) => a.order - b.order));
  const [benefits, setBenefits] = useState(() => [...data.benefits].sort((a, b) => a.order - b.order));
  const [faqs, setFaqs] = useState(() => [...data.faqs].sort((a, b) => a.order - b.order));
  const [editorStep, setEditorStep] = useState<"content" | "items" | "appearance">(() => block && ["hero", "trust"].includes(block.kind) ? "items" : "content");
  const hasEditorialFields = !["hero", "trust", "spacer"].includes(form.kind);
  const supportsButton = ["featured", "promo", "text", "image", "cta"].includes(form.kind);
  const supportsColumns = ["trust", "featured", "benefits"].includes(form.kind);
  const hasResourceEditor = resourceBlockKinds.includes(form.kind);
  const selectedKind = blockKinds.find((item) => item.value === form.kind);
  function field<K extends keyof PageBlock>(key: K, value: PageBlock[K]) { setForm((current) => ({ ...current, [key]: value })); }
  const toggleSelection = (values: string[], id: string, setter: (values: string[]) => void) => setter(values.includes(id) ? values.filter((item) => item !== id) : [...values, id]);

  function selectBlockKind(kind: PageBlockKind) {
    const metadata = blockKinds.find((item) => item.value === kind);
    const source = data.sections.find((section) => section.kind === kind);
    setForm((current) => ({
      ...current,
      kind,
      name: metadata?.label ?? current.name,
      eyebrow: kind === "promo" ? data.settings.freeShippingBannerEyebrow : source?.eyebrow ?? (["hero", "trust", "spacer"].includes(kind) ? "" : current.eyebrow),
      title: kind === "promo" ? data.settings.freeShippingBannerTitle : source?.title ?? (["hero", "trust", "spacer"].includes(kind) ? "" : current.title),
      body: kind === "promo" ? data.settings.freeShippingBannerSubtitle : source?.subtitle ?? (["hero", "trust", "spacer"].includes(kind) ? "" : current.body),
      buttonText: kind === "promo" ? data.settings.freeShippingBannerButtonText : source?.buttonText ?? (["featured", "text", "image", "cta"].includes(kind) ? current.buttonText : ""),
      buttonLink: kind === "promo" ? data.settings.freeShippingBannerButtonLink : source?.buttonLink ?? (["featured", "text", "image", "cta"].includes(kind) ? current.buttonLink : ""),
    }));
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = pageBlockSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revise os campos.");
      setEditorStep("content");
      return;
    }
    if (form.kind === "hero" && !activeBannerIds.length) { setError("Selecione pelo menos um banner visível."); setEditorStep("items"); }
    else if (form.kind === "featured" && !featuredProductIds.length) { setError("Selecione pelo menos um produto em destaque."); setEditorStep("items"); }
    else if (form.kind === "catalog" && !activeCategoryIds.length) { setError("Selecione pelo menos uma categoria para o catálogo."); setEditorStep("items"); }
    else if (form.kind === "trust" && !trustItems.length) { setError("Adicione pelo menos um item à faixa de confiança."); setEditorStep("items"); }
    else if (form.kind === "trust" && trustItems.some((item) => !item.title.trim() || !item.subtitle.trim())) { setError("Preencha o título e o texto de todos os itens da faixa de confiança."); setEditorStep("items"); }
    else if (form.kind === "benefits" && !benefits.length) { setError("Adicione pelo menos um card de benefício."); setEditorStep("items"); }
    else if (form.kind === "benefits" && benefits.some((item) => !item.title.trim() || !item.text.trim())) { setError("Preencha o título e o texto de todos os benefícios."); setEditorStep("items"); }
    else if (form.kind === "faq" && !faqs.length) { setError("Adicione pelo menos uma pergunta frequente."); setEditorStep("items"); }
    else if (form.kind === "faq" && faqs.some((item) => !item.question.trim() || !item.answer.trim())) { setError("Preencha todas as perguntas e respostas antes de publicar."); setEditorStep("items"); }
    else if (form.kind === "faq" && faqs.some((item) => item.question.trim() === legacyFaqDraft.question && item.answer.trim() === legacyFaqDraft.answer)) { setError("Substitua ou exclua as perguntas de exemplo antes de publicar."); setEditorStep("items"); }
    else {
      setSaving(true);
      setError("");
      try {
        if (form.kind === "hero") {
          await saveBannerVisibility(activeBannerIds);
          if (bannerSeconds !== data.settings.autoBannerSeconds) await saveSettings({ ...data.settings, autoBannerSeconds: bannerSeconds });
        }
        if (form.kind === "featured") await saveFeaturedProducts(featuredProductIds);
        if (form.kind === "catalog") await saveCategoryVisibility(activeCategoryIds);
        if (form.kind === "trust") await saveTrustItems(trustItems);
        if (form.kind === "benefits") await saveBenefits(benefits);
        if (form.kind === "faq") await saveFaqs(faqs);
        await savePageBlock(form);
        onClose();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Não foi possível salvar este bloco.");
      } finally {
        setSaving(false);
      }
    }
  }

  const normalizedQuery = resourceQuery.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = [...data.products]
    .filter((product) => product.active && (!normalizedQuery || `${product.name} ${product.sku} ${product.category}`.toLocaleLowerCase("pt-BR").includes(normalizedQuery)))
    .sort((a, b) => Number(featuredProductIds.includes(b.id)) - Number(featuredProductIds.includes(a.id)) || a.order - b.order);

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="block-editor-title">
      <button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" />
      <div className="admin-modal-panel layout-block-editor-panel">
        <header><div><span>EDITOR DE SEÇÃO</span><h2 id="block-editor-title">{block ? "Editar seção" : "Adicionar seção"}</h2><small>{page.name} · {selectedKind?.label}</small></div><button onClick={onClose} aria-label="Fechar"><X /></button></header>
        <form className="layout-block-editor-form" onSubmit={submit}>
          <nav className="layout-editor-steps" aria-label="Etapas da edição">
            <button type="button" aria-label="Conteúdo" className={editorStep === "content" ? "active" : ""} onClick={() => setEditorStep("content")} aria-current={editorStep === "content" ? "step" : undefined}><BookOpenText /><span><strong>Conteúdo</strong><small>Textos e chamada</small></span></button>
            {hasResourceEditor && <button type="button" aria-label="Itens exibidos" className={editorStep === "items" ? "active" : ""} onClick={() => setEditorStep("items")} aria-current={editorStep === "items" ? "step" : undefined}><GalleryHorizontalEnd /><span><strong>Itens exibidos</strong><small>Produtos, banners ou listas</small></span></button>}
            <button type="button" aria-label="Aparência" className={editorStep === "appearance" ? "active" : ""} onClick={() => setEditorStep("appearance")} aria-current={editorStep === "appearance" ? "step" : undefined}><Paintbrush /><span><strong>Aparência</strong><small>Tamanho, cores e publicação</small></span></button>
          </nav>

          {editorStep === "content" && <div className="layout-editor-step admin-form">
            {block ? <div className={`layout-kind-summary full kind-${form.kind}`}><span><BlockKindIcon kind={form.kind} /></span><div><small>TIPO DA SEÇÃO</small><strong>{selectedKind?.label}</strong><p>{selectedKind?.description}</p></div></div> : <label className="full">Que tipo de seção você quer adicionar?<select aria-label="Tipo de conteúdo" value={form.kind} onChange={(event) => selectBlockKind(event.target.value as PageBlockKind)}>{blockKinds.map((kind) => <option value={kind.value} key={kind.value}>{kind.label}</option>)}</select><small className="field-hint">{selectedKind?.description}</small></label>}

            {hasEditorialFields ? <>
              <label>Chamada pequena <input value={form.eyebrow} onChange={(event) => field("eyebrow", event.target.value)} placeholder="Ex.: SELEÇÃO ESPECIAL" /><small className="field-hint">Aparece acima do título.</small></label>
              <label>Título que o cliente verá <input value={form.title} onChange={(event) => field("title", event.target.value)} placeholder={selectedKind?.label} /></label>
              <label className="full">{form.kind === "faq" ? "Texto de introdução" : "Texto de apoio"}<textarea value={form.body} onChange={(event) => field("body", event.target.value)} placeholder="Explique esta seção de forma curta e clara." /></label>
              {supportsButton && <><label>Texto do botão <input value={form.buttonText} onChange={(event) => field("buttonText", event.target.value)} placeholder="Ex.: Ver produtos" /></label><label>Destino do botão <input value={form.buttonLink} onChange={(event) => field("buttonLink", event.target.value)} placeholder="/#catalogo" /><small className="field-hint">Use um endereço da loja, como /#catalogo.</small></label></>}
            </> : <div className="layout-editor-guidance full"><ListChecks /><div><strong>Esta seção não precisa de textos.</strong><p>{hasResourceEditor ? "Abra “Itens exibidos” para escolher o que aparece na loja." : "Use a aba Aparência para ajustar o espaço entre as seções."}</p>{hasResourceEditor && <button className="admin-button" type="button" onClick={() => setEditorStep("items")}>Escolher itens <ChevronRight /></button>}</div></div>}

            {form.kind === "image" && <><label className="full">Endereço da imagem <input value={form.imageUrl} onChange={(event) => field("imageUrl", event.target.value)} /></label><label className="full upload-label"><ImagePlus /> {uploading ? "Enviando..." : "Escolher imagem do computador"}<input type="file" accept="image/*" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { field("imageUrl", await uploadMedia(file, "site-media")); } finally { setUploading(false); } }} /></label></>}
          </div>}

          {editorStep === "items" && hasResourceEditor && <div className="layout-editor-step admin-form">
            {form.kind === "hero" && <div className="layout-resource-section full">
              <div className="layout-resource-heading"><div><strong>Banners que aparecem na loja</strong><span>Marque as campanhas que devem rodar no topo da página.</span></div><Link className="admin-button" href="/admin/banners">Editar imagens dos banners</Link></div>
              <div className="layout-choice-grid">{[...data.banners].sort((a, b) => a.order - b.order).map((banner) => <label key={banner.id}><input type="checkbox" checked={activeBannerIds.includes(banner.id)} onChange={() => toggleSelection(activeBannerIds, banner.id, setActiveBannerIds)} /><span><strong>{banner.title || banner.altText || "Banner sem título"}</strong><small>{banner.imageOnly ? "Somente imagem" : "Imagem com texto e botão"}</small></span></label>)}</div>
              <label className="layout-resource-number">Trocar banner a cada <span className="layout-input-suffix"><input type="number" min="3" max="30" value={bannerSeconds} onChange={(event) => setBannerSeconds(Math.max(3, Math.min(30, Number(event.target.value))))} /><b>segundos</b></span></label>
            </div>}

            {form.kind === "featured" && <div className="layout-resource-section full">
              <div className="layout-resource-heading"><div><strong>Escolha os produtos em destaque</strong><span>Os selecionados ficam no começo desta lista. A ordem na loja segue o catálogo.</span></div><span className="layout-selection-count">{featuredProductIds.length} selecionados</span></div>
              <div className="layout-resource-toolbar"><label className="layout-resource-search">Buscar produto <input value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} placeholder="Digite nome, SKU ou categoria" /></label><div><button type="button" onClick={() => setFeaturedProductIds(Array.from(new Set([...featuredProductIds, ...visibleProducts.map((product) => product.id)])))}>Selecionar resultados</button><button type="button" onClick={() => setFeaturedProductIds([])}>Limpar seleção</button></div></div>
              <div className="layout-choice-grid product-choice-grid">{visibleProducts.map((product) => <label key={product.id}><input type="checkbox" checked={featuredProductIds.includes(product.id)} onChange={() => toggleSelection(featuredProductIds, product.id, setFeaturedProductIds)} /><span><strong>{product.name}</strong><small>{product.category} · {product.sku}</small></span></label>)}</div>
              {!visibleProducts.length && <div className="layout-resource-empty"><PackageSearch /><span>Nenhum produto encontrado nesta busca.</span></div>}
            </div>}

            {form.kind === "catalog" && <div className="layout-resource-section full">
              <div className="layout-resource-heading"><div><strong>Categorias disponíveis no catálogo</strong><span>Desmarque somente o que não deve aparecer para o cliente.</span></div><Link className="admin-button" href="/admin/categories">Gerenciar categorias</Link></div>
              <div className="layout-choice-grid">{[...data.categories].sort((a, b) => a.order - b.order).map((category) => <label key={category.id}><input type="checkbox" checked={activeCategoryIds.includes(category.id)} onChange={() => toggleSelection(activeCategoryIds, category.id, setActiveCategoryIds)} /><span><strong>{category.name}</strong><small>{data.products.filter((product) => product.categoryId === category.id && product.active).length} produtos ativos</small></span></label>)}</div>
            </div>}

            {form.kind === "trust" && <TrustItemsEditor items={trustItems} onChange={setTrustItems} />}
            {form.kind === "benefits" && <BenefitsEditor items={benefits} onChange={setBenefits} />}
            {form.kind === "faq" && <FaqEditor items={faqs} onChange={setFaqs} />}
          </div>}

          {editorStep === "appearance" && <div className="layout-editor-step admin-form">
            <div className="layout-appearance-intro full"><Paintbrush /><div><strong>Aparência da seção</strong><p>Se estiver em dúvida, mantenha “Padrão” e “Médio”. Essas opções funcionam bem no computador e no celular.</p></div></div>
            {form.kind !== "hero" && <>
              {form.kind !== "spacer" && <label>Largura na página <select value={form.containerWidth} onChange={(event) => field("containerWidth", event.target.value as PageBlock["containerWidth"])}><option value="narrow">Estreita — melhor para textos</option><option value="normal">Padrão — recomendada</option><option value="wide">Ampla — mais conteúdo</option><option value="full">Tela inteira</option></select></label>}
              <label>Espaço acima e abaixo <select value={form.padding} onChange={(event) => field("padding", event.target.value as PageBlock["padding"])}><option value="none">Sem espaço</option><option value="small">Pequeno</option><option value="medium">Médio — recomendado</option><option value="large">Grande</option></select></label>
              {form.kind !== "spacer" && <><label>Cor de fundo <input type="color" value={form.backgroundColor || "#07090d"} onChange={(event) => field("backgroundColor", event.target.value)} /></label><label>Cor do texto <input type="color" value={form.textColor || "#f5f7fb"} onChange={(event) => field("textColor", event.target.value)} /></label></>}
              {supportsColumns && <label>Itens por linha <input type="number" min="1" max="4" value={form.columns} onChange={(event) => field("columns", Number(event.target.value))} /><small className="field-hint">No celular, o editor ajusta automaticamente.</small></label>}
            </>}
            <label className="full layout-internal-name">Nome para identificar no painel <input value={form.name} onChange={(event) => field("name", event.target.value)} /><small className="field-hint">Este nome não aparece para o cliente.</small></label>
            <label className={`layout-publish-choice full ${form.active ? "active" : ""}`}><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /><span>{form.active ? <Eye /> : <EyeOff />}<span><strong>{form.active ? "Seção visível na loja" : "Seção oculta da loja"}</strong><small>{form.active ? "Os clientes conseguem ver esta seção." : "Ela ficará salva no painel, mas não aparecerá na loja."}</small></span></span></label>
          </div>}

          {error && <p className="admin-form-error layout-editor-error">{error}</p>}
          <div className="layout-editor-footer"><div><span>PASSO 3</span><strong>{selectedKind?.label}</strong><small>{form.active ? "Será publicada na loja" : "Será salva como oculta"}</small></div><div><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" disabled={saving || uploading}><Save /> {saving ? "Salvando alterações..." : "Salvar e publicar"}</button></div></div>
        </form>
      </div>
    </div>
  );
}

function moveResourceItem<T>(items: T[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function ResourceRowActions({ index, count, onMove, onDelete }: { index: number; count: number; onMove: (direction: -1 | 1) => void; onDelete: () => void }) {
  return <div className="layout-resource-actions"><button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Mover para cima"><ArrowUp /></button><button type="button" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Mover para baixo"><ArrowDown /></button><button type="button" className="danger" onClick={onDelete} aria-label="Excluir"><Trash2 /></button></div>;
}

function TrustItemsEditor({ items, onChange }: { items: TrustItem[]; onChange: (items: TrustItem[]) => void }) {
  return <div className="layout-resource-section full"><div className="layout-resource-heading"><div><strong>Itens da faixa de confiança</strong><span>Mensagens curtas exibidas logo abaixo dos banners.</span></div><button className="admin-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), title: "Novo benefício", subtitle: "Explique em uma frase curta.", order: items.length + 1 }])}><Plus /> Adicionar item</button></div><div className="layout-editable-list">{items.map((item, index) => <article key={item.id}><div className="layout-editable-fields"><label>Título<input value={item.title} maxLength={60} onChange={(event) => onChange(items.map((current) => current.id === item.id ? { ...current, title: event.target.value } : current))} /></label><label>Texto<input value={item.subtitle} maxLength={100} onChange={(event) => onChange(items.map((current) => current.id === item.id ? { ...current, subtitle: event.target.value } : current))} /></label></div><ResourceRowActions index={index} count={items.length} onMove={(direction) => onChange(moveResourceItem(items, index, direction))} onDelete={() => onChange(items.filter((current) => current.id !== item.id))} /></article>)}</div></div>;
}

function BenefitsEditor({ items, onChange }: { items: Benefit[]; onChange: (items: Benefit[]) => void }) {
  return <div className="layout-resource-section full"><div className="layout-resource-heading"><div><strong>Cards de benefícios</strong><span>Explique de forma simples como funciona a experiência de compra.</span></div><button className="admin-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), title: "Novo benefício", text: "Descreva este benefício.", order: items.length + 1 }])}><Plus /> Adicionar benefício</button></div><div className="layout-editable-list">{items.map((item, index) => <article key={item.id}><div className="layout-editable-fields"><label>Título<input value={item.title} maxLength={80} onChange={(event) => onChange(items.map((current) => current.id === item.id ? { ...current, title: event.target.value } : current))} /></label><label>Descrição<textarea value={item.text} maxLength={240} onChange={(event) => onChange(items.map((current) => current.id === item.id ? { ...current, text: event.target.value } : current))} /></label></div><ResourceRowActions index={index} count={items.length} onMove={(direction) => onChange(moveResourceItem(items, index, direction))} onDelete={() => onChange(items.filter((current) => current.id !== item.id))} /></article>)}</div></div>;
}

function FaqEditor({ items, onChange }: { items: Faq[]; onChange: (items: Faq[]) => void }) {
  return <div className="layout-resource-section full"><div className="layout-resource-heading"><div><strong>Perguntas frequentes</strong><span>Edite as dúvidas que aparecem na seção “Como comprar”.</span></div><button className="admin-button" type="button" onClick={() => onChange([...items, { id: crypto.randomUUID(), question: "", answer: "", order: items.length + 1 }])}><Plus /> Adicionar pergunta</button></div><div className="layout-editable-list">{items.map((item, index) => <article key={item.id}><div className="layout-editable-fields"><label>Pergunta<input value={item.question} maxLength={140} placeholder="Ex.: Como acompanho meu pedido?" onChange={(event) => onChange(items.map((current) => current.id === item.id ? { ...current, question: event.target.value } : current))} /></label><label>Resposta<textarea value={item.answer} maxLength={600} placeholder="Escreva uma resposta clara para o cliente." onChange={(event) => onChange(items.map((current) => current.id === item.id ? { ...current, answer: event.target.value } : current))} /></label></div><ResourceRowActions index={index} count={items.length} onMove={(direction) => onChange(moveResourceItem(items, index, direction))} onDelete={() => onChange(items.filter((current) => current.id !== item.id))} /></article>)}</div></div>;
}
