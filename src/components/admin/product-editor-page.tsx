"use client";
/* eslint-disable @next/next/no-img-element */

import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconGripVertical,
  IconInfoCircle,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconTrash,
  IconUpload,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConfirm } from "@/components/providers/confirm-provider";
import { useToast } from "@/components/providers/toast-provider";
import { ProductArt } from "@/components/ui/product-art";
import { formatMoney } from "@/lib/format";
import { normalizeProductImages, removeProductImage, reorderProductImages, setProductCover } from "@/lib/product-images";
import { createUniqueProductSlug, toProductSaveError } from "@/lib/product-slug";
import { productSchema } from "@/lib/validation";
import type { Product } from "@/types/store";
import { useAdminData } from "./admin-data-provider";

const steps = [
  { title: "Informações", description: "Nome, categoria e descrição", icon: IconPackage },
  { title: "Fotos", description: "Galeria e imagem de capa", icon: IconPhoto },
  { title: "Preço e estoque", description: "Valores e disponibilidade", icon: IconPlus },
  { title: "Publicação", description: "Visibilidade e revisão", icon: IconCheck },
] as const;

const stepFields: Array<Array<keyof Product>> = [
  ["name", "sku", "categoryId", "brand", "description"],
  ["imageUrl", "imageUrls"],
  ["price", "compareAt", "stock", "badge", "rating", "reviews", "accent"],
  ["name", "sku", "categoryId", "brand", "description", "imageUrl", "imageUrls", "price", "compareAt", "stock", "badge", "rating", "reviews", "accent", "featured", "active"],
];

function withGallery(product: Product): Product {
  const imageUrls = normalizeProductImages(product);
  return { ...product, imageUrls, imageUrl: product.imageUrl || imageUrls[0] || "" };
}

export function ProductEditorPage({ productId }: { productId?: string }) {
  const { data, saveProduct, uploadMedia } = useAdminData();
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const existingProduct = productId ? data.products.find((product) => product.id === productId) : undefined;
  const defaultCategory = data.categories[0];
  const startingProduct = useMemo<Product>(() => withGallery(existingProduct ?? {
    id: "new-product",
    slug: "",
    name: "",
    categoryId: defaultCategory?.id ?? "",
    category: defaultCategory?.name ?? "",
    brand: "",
    price: 0,
    compareAt: 0,
    stock: 0,
    badge: "",
    accent: data.settings.primaryColor,
    description: "",
    sku: `${data.settings.orderPrefix}-${String(data.products.length + 1).padStart(3, "0")}`,
    rating: 5,
    reviews: 0,
    featured: false,
    active: true,
    order: data.products.length + 1,
    imageUrl: "",
    imageUrls: [],
    productType: "unclassified",
    regulatoryStatus: "pending",
    activeIngredient: "",
    anvisaRegistration: "",
    presentation: "",
    regulatoryWarning: "",
    pharmacistReviewed: false,
  }), [data.products.length, data.settings.orderPrefix, data.settings.primaryColor, defaultCategory?.id, defaultCategory?.name, existingProduct]);
  const [form, setForm] = useState<Product>(startingProduct);
  const initialForm = useRef(JSON.stringify(startingProduct));
  const restoredDraft = useRef(false);
  const [step, setStep] = useState(0);
  const [furthestStep, setFurthestStep] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const draftKey = `junior-imports:product-draft:${productId ?? "new"}`;
  const images = normalizeProductImages(form);
  const cover = form.imageUrl || images[0] || "";

  useEffect(() => {
    if (productId || restoredDraft.current) return;
    restoredDraft.current = true;
    const saved = window.localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const restored = withGallery(JSON.parse(saved) as Product);
      setForm(restored);
      initialForm.current = JSON.stringify(restored);
      toast({ message: "Rascunho recuperado neste navegador.", kind: "success" });
    } catch {
      window.localStorage.removeItem(draftKey);
    }
  }, [draftKey, productId, toast]);

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(form) === initialForm.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [form]);

  const field = useCallback(<K extends keyof Product>(key: K, value: Product[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
    setError("");
  }, []);

  const requestExit = useCallback(async () => {
    if (JSON.stringify(form) !== initialForm.current) {
      const accepted = await confirm({
        title: "Sair sem salvar?",
        description: "As alterações ainda não salvas permanecerão apenas se você criar um rascunho.",
        confirmLabel: "Sair mesmo assim",
        danger: true,
      });
      if (!accepted) return;
    }
    router.push("/admin/products");
  }, [confirm, form, router]);

  function collectErrors(targetStep: number) {
    const parsed = productSchema.safeParse({ ...form, imageUrls: images, imageUrl: cover });
    if (parsed.success) return {};
    const allowed = new Set(stepFields[targetStep]);
    const nextErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (allowed.has(key as keyof Product) && !nextErrors[key]) nextErrors[key] = issue.message;
    }
    return nextErrors;
  }

  function validateStep(targetStep: number) {
    const nextErrors = collectErrors(targetStep);
    setFieldErrors(nextErrors);
    if (!Object.keys(nextErrors).length) return true;
    setError("Revise os campos destacados para continuar.");
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
    return false;
  }

  function continueFlow(event?: React.SyntheticEvent) {
    event?.preventDefault();
    if (!validateStep(step)) return;
    const next = Math.min(steps.length - 1, step + 1);
    setStep(next);
    setFurthestStep((current) => Math.max(current, next));
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openStep(index: number) {
    if (index > furthestStep) return;
    setStep(index);
    setError("");
    setFieldErrors({});
  }

  function saveDraft() {
    window.localStorage.setItem(draftKey, JSON.stringify({ ...form, imageUrls: images, imageUrl: cover }));
    initialForm.current = JSON.stringify({ ...form, imageUrls: images, imageUrl: cover });
    toast({ message: "Rascunho salvo neste navegador.", kind: "success" });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const finalErrors = collectErrors(3);
    if (Object.keys(finalErrors).length) {
      setFieldErrors(finalErrors);
      const firstInvalidStep = stepFields.slice(0, 3).findIndex((fields) => fields.some((key) => Boolean(finalErrors[key])));
      setStep(firstInvalidStep >= 0 ? firstInvalidStep : 0);
      setError("Revise os campos destacados antes de salvar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const selectedCategory = data.categories.find((category) => category.id === form.categoryId);
    if (!selectedCategory) {
      setStep(0);
      setFieldErrors({ categoryId: "Selecione uma categoria válida." });
      return;
    }
    setSaving(true);
    setError("");
    try {
      const savedProductId = productId ? form.id : crypto.randomUUID();
      const savedProduct: Product = {
        ...form,
        id: savedProductId,
        slug: createUniqueProductSlug(productId && form.slug ? form.slug : form.name, data.products, savedProductId),
        category: selectedCategory.name,
        imageUrl: cover,
        imageUrls: images,
      };
      await saveProduct(savedProduct);
      window.localStorage.removeItem(draftKey);
      initialForm.current = JSON.stringify(form);
      router.push("/admin/products");
    } catch (caught) {
      setError(toProductSaveError(caught).message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (!files.length) return;
    const availableSlots = 10 - images.length;
    if (availableSlots <= 0) {
      setError("A galeria aceita no máximo 10 imagens.");
      return;
    }
    if (files.length > availableSlots) {
      setError(`Você pode adicionar mais ${availableSlots} ${availableSlots === 1 ? "imagem" : "imagens"}.`);
      return;
    }
    setUploading(true);
    setError("");
    const uploaded: string[] = [];
    try {
      for (const file of files) uploaded.push(await uploadMedia(file, "product-media"));
      setForm((current) => {
        const currentImages = normalizeProductImages(current);
        const imageUrls = [...currentImages, ...uploaded];
        return { ...current, imageUrls, imageUrl: current.imageUrl || uploaded[0] || "" };
      });
      setFieldErrors((current) => ({ ...current, imageUrl: "", imageUrls: "" }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível enviar as imagens.");
    } finally {
      setUploading(false);
    }
  }

  function addImageUrl() {
    const nextUrl = urlInput.trim();
    if (!/^(https?:\/\/|data:image\/|\/)/i.test(nextUrl)) {
      setError("Informe uma URL de imagem válida.");
      return;
    }
    if (images.length >= 10) {
      setError("A galeria aceita no máximo 10 imagens.");
      return;
    }
    if (images.includes(nextUrl)) {
      setError("Esta imagem já faz parte da galeria.");
      return;
    }
    setForm((current) => ({ ...current, imageUrls: [...normalizeProductImages(current), nextUrl], imageUrl: current.imageUrl || nextUrl }));
    setUrlInput("");
    setError("");
  }

  function moveImage(fromIndex: number, toIndex: number) {
    setForm((current) => ({ ...current, ...reorderProductImages(current, fromIndex, toIndex) }));
  }

  if (productId && !existingProduct) {
    return (
      <section className="product-editor-missing">
        <IconPackage />
        <span>PRODUTOS</span>
        <h1>Produto não encontrado.</h1>
        <p>Ele pode ter sido removido ou não pertencer a esta loja.</p>
        <Link className="admin-button primary" href="/admin/products"><IconArrowLeft /> Voltar para produtos</Link>
      </section>
    );
  }

  const issue = (key: keyof Product) => fieldErrors[key] ? <small className="admin-field-error">{fieldErrors[key]}</small> : null;

  return (
    <form className="product-editor-page" id="product-editor-form" onSubmit={submit} noValidate>
      <header className="product-editor-header">
        <div className="product-editor-heading">
          <button type="button" className="product-editor-back" onClick={() => void requestExit()}><IconArrowLeft /> Voltar para produtos</button>
          <div><span>CATÁLOGO</span><h1>{productId ? "Editar produto" : "Cadastrar produto"}</h1><p>{step + 1} de {steps.length} etapas · {steps[step].title}</p></div>
        </div>
        <div className="product-editor-header-actions">
          <button type="button" className="admin-button" onClick={saveDraft}>Salvar rascunho</button>
          {step < steps.length - 1
            ? <button type="button" className="admin-button primary" onClick={continueFlow}>Continuar <IconArrowRight /></button>
            : <button type="submit" className="admin-button primary" disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar produto"} <IconCheck /></button>}
        </div>
      </header>

      <div className="product-editor-progress" aria-hidden="true"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>

      <div className="product-editor-layout">
        <nav className="product-editor-steps" aria-label="Etapas do cadastro">
          {steps.map(({ title, description, icon: StepIcon }, index) => (
            <button
              type="button"
              key={title}
              className={`${index === step ? "active" : ""} ${index < furthestStep ? "completed" : ""}`}
              onClick={() => openStep(index)}
              disabled={index > furthestStep}
              aria-current={index === step ? "step" : undefined}
            >
              <span>{index < furthestStep ? <IconCheck /> : <StepIcon />}</span>
              <div><strong>{title}</strong><small>{description}</small></div>
            </button>
          ))}
        </nav>

        <main className="product-editor-main">
          {error && <div className="product-editor-alert" role="alert"><IconInfoCircle /><span>{error}</span></div>}

          {step === 0 && (
            <section className="product-editor-section" aria-labelledby="product-information-title">
              <div className="product-editor-section-heading"><span>ETAPA 1</span><h2 id="product-information-title">Informações do produto</h2><p>Comece pelo essencial. Você poderá revisar tudo antes de publicar.</p></div>
              <div className="product-editor-fields">
                <label className="full">Nome do produto<input value={form.name} aria-invalid={Boolean(fieldErrors.name)} onChange={(event) => field("name", event.target.value)} placeholder="Ex.: T.G. 15" autoFocus />{issue("name")}</label>
                <label>Marca<input value={form.brand} aria-invalid={Boolean(fieldErrors.brand)} onChange={(event) => field("brand", event.target.value)} placeholder="Nome da marca" />{issue("brand")}</label>
                <label>SKU<input value={form.sku} aria-invalid={Boolean(fieldErrors.sku)} onChange={(event) => field("sku", event.target.value)} />{issue("sku")}</label>
                <label>Categoria<select value={form.categoryId} aria-invalid={Boolean(fieldErrors.categoryId)} onChange={(event) => { const category = data.categories.find((item) => item.id === event.target.value); setForm((current) => ({ ...current, categoryId: event.target.value, category: category?.name ?? "" })); setFieldErrors((current) => ({ ...current, categoryId: "" })); }}>{data.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>{issue("categoryId")}</label>
                <label>Etiqueta<input value={form.badge} onChange={(event) => field("badge", event.target.value)} placeholder="Ex.: Mais vendido" /></label>
                <label className="full">Descrição<textarea value={form.description} aria-invalid={Boolean(fieldErrors.description)} onChange={(event) => field("description", event.target.value)} placeholder="Descreva apresentação, diferenciais e informações importantes." rows={7} />{issue("description")}<small className="product-editor-hint">{form.description.length} caracteres</small></label>
              </div>
            </section>
          )}

          {step === 1 && (
            <section className="product-editor-section product-editor-photos" aria-labelledby="product-photos-title">
              <div className="product-editor-section-heading product-editor-photo-heading"><div><span>ETAPA 2</span><h2 id="product-photos-title">Fotos do produto</h2><p>Adicione até 10 imagens, escolha a capa e arraste para ordenar a galeria.</p></div><strong>{images.length}/10</strong></div>

              <label
                className={`product-photo-dropzone ${uploading ? "is-uploading" : ""}`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => { event.preventDefault(); void uploadFiles(event.dataTransfer.files); }}
              >
                <span><IconUpload /></span>
                <strong>{uploading ? "Enviando imagens..." : "Arraste as imagens ou clique para selecionar"}</strong>
                <small>JPG, PNG, WebP, GIF ou AVIF · máximo de 5 MB por arquivo</small>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={uploading || images.length >= 10} onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.currentTarget.value = ""; }} />
              </label>

              {images.length > 0 && <div className="product-photo-grid" aria-label="Galeria de imagens">
                {images.map((image, index) => {
                  const isCover = image === cover;
                  return (
                    <article
                      className={`product-photo-card ${isCover ? "is-cover" : ""}`}
                      key={`${image}-${index}`}
                      draggable
                      onDragStart={() => setDraggedIndex(index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => { if (draggedIndex !== null) moveImage(draggedIndex, index); setDraggedIndex(null); }}
                    >
                      <div className="product-photo-image">
                        <img src={image} alt={`${form.name || "Produto"} — foto ${index + 1}`} />
                        <span className="product-photo-position"><IconGripVertical /> {index + 1}</span>
                        <button type="button" className="product-photo-remove" onClick={() => setForm((current) => ({ ...current, ...removeProductImage(current, image) }))} aria-label={`Remover foto ${index + 1}`}><IconTrash /></button>
                      </div>
                      <div className="product-photo-card-footer">
                        {isCover ? <strong><IconCheck /> Imagem de capa</strong> : <button type="button" onClick={() => setForm((current) => ({ ...current, ...setProductCover(current, image) }))}>Usar como capa</button>}
                        <div><button type="button" disabled={index === 0} onClick={() => moveImage(index, index - 1)} aria-label={`Mover foto ${index + 1} para a esquerda`}><IconChevronLeft /></button><button type="button" disabled={index === images.length - 1} onClick={() => moveImage(index, index + 1)} aria-label={`Mover foto ${index + 1} para a direita`}><IconChevronRight /></button></div>
                      </div>
                    </article>
                  );
                })}
                {images.length < 10 && <label className="product-photo-add-tile"><IconPlus /><strong>Adicionar fotos</strong><small>{10 - images.length} disponíveis</small><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" multiple disabled={uploading} onChange={(event) => { if (event.target.files) void uploadFiles(event.target.files); event.currentTarget.value = ""; }} /></label>}
              </div>}
              {issue("imageUrl") || issue("imageUrls")}

              <details className="product-photo-url">
                <summary>Adicionar imagem por URL <IconChevronDown /></summary>
                <div><input value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder="https://exemplo.com/produto.jpg" aria-label="URL da imagem" /><button type="button" className="admin-button" onClick={addImageUrl}>Adicionar</button></div>
              </details>
            </section>
          )}

          {step === 2 && (
            <section className="product-editor-section" aria-labelledby="product-price-title">
              <div className="product-editor-section-heading"><span>ETAPA 3</span><h2 id="product-price-title">Preço e estoque</h2><p>Defina os valores e a disponibilidade exibidos na loja.</p></div>
              <div className="product-editor-fields">
                <label>Preço de venda (R$)<input type="number" step="0.01" min="0" value={form.price} aria-invalid={Boolean(fieldErrors.price)} onChange={(event) => field("price", Number(event.target.value))} autoFocus />{issue("price")}</label>
                <label>Preço anterior (R$)<input type="number" step="0.01" min="0" value={form.compareAt} aria-invalid={Boolean(fieldErrors.compareAt)} onChange={(event) => field("compareAt", Number(event.target.value))} />{issue("compareAt")}</label>
                <label>Quantidade em estoque<input type="number" min="0" value={form.stock} aria-invalid={Boolean(fieldErrors.stock)} onChange={(event) => field("stock", Number(event.target.value))} />{issue("stock")}</label>
                <label>Cor do mockup<input className="product-color-input" type="color" value={form.accent} aria-invalid={Boolean(fieldErrors.accent)} onChange={(event) => field("accent", event.target.value)} />{issue("accent")}</label>
                <label>Avaliação<input type="number" min="0" max="5" step="0.1" value={form.rating} aria-invalid={Boolean(fieldErrors.rating)} onChange={(event) => field("rating", Number(event.target.value))} />{issue("rating")}</label>
                <label>Número de avaliações<input type="number" min="0" value={form.reviews} aria-invalid={Boolean(fieldErrors.reviews)} onChange={(event) => field("reviews", Number(event.target.value))} />{issue("reviews")}</label>
              </div>
              {form.compareAt > form.price && form.price > 0 && <div className="product-editor-discount"><IconCheck /><div><strong>Oferta configurada</strong><small>O cliente verá {Math.round((1 - form.price / form.compareAt) * 100)}% de desconto.</small></div></div>}
            </section>
          )}

          {step === 3 && (
            <section className="product-editor-section" aria-labelledby="product-publish-title">
              <div className="product-editor-section-heading"><span>ETAPA 4</span><h2 id="product-publish-title">Publicação</h2><p>Revise como o produto ficará disponível no catálogo.</p></div>
              <div className="product-publish-options">
                <label><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /><span><strong>Produto visível</strong><small>Aparece no catálogo e pode ser adicionado ao carrinho.</small></span></label>
                <label><input type="checkbox" checked={form.featured} onChange={(event) => field("featured", event.target.checked)} /><span><strong>Produto em destaque</strong><small>Pode aparecer nas seções promocionais da página inicial.</small></span></label>
              </div>
              <div className="product-review-card">
                <div className="product-review-image">{cover ? <img src={cover} alt="Capa selecionada" /> : <ProductArt product={form} />}</div>
                <div><span>REVISÃO FINAL</span><h3>{form.name || "Produto sem nome"}</h3><p>{form.category} · {form.brand || "Marca não informada"}</p><strong>{formatMoney(form.price)}</strong><small>{images.length} {images.length === 1 ? "imagem" : "imagens"} · {form.stock} em estoque</small></div>
              </div>
            </section>
          )}

          <footer className="product-editor-footer">
            <button type="button" className="admin-button" onClick={() => step === 0 ? void requestExit() : setStep((current) => Math.max(0, current - 1))}>{step === 0 ? "Cancelar" : "Voltar"}</button>
            {step < steps.length - 1
              ? <button type="button" className="admin-button primary" onClick={continueFlow}>Continuar <IconArrowRight /></button>
              : <button type="submit" className="admin-button primary" disabled={saving || uploading}>{saving ? "Salvando..." : "Salvar produto"} <IconCheck /></button>}
          </footer>
        </main>

        <aside className="product-editor-summary">
          <div className="product-editor-summary-sticky">
            <div className="product-editor-summary-heading"><span>PRÉVIA DO PRODUTO</span><small>{form.active ? "Visível" : "Oculto"}</small></div>
            <div className="product-editor-summary-image" style={{ "--product-accent": form.accent } as React.CSSProperties}>{cover ? <img src={cover} alt={form.name || "Prévia do produto"} /> : <ProductArt product={form} large />}</div>
            <div className="product-editor-summary-copy"><span>{form.category || "Sem categoria"}</span><h3>{form.name || "Nome do produto"}</h3><p>{form.description || "A descrição do produto aparecerá aqui."}</p><div><strong>{formatMoney(form.price)}</strong>{form.compareAt > form.price && <del>{formatMoney(form.compareAt)}</del>}</div><small>{form.stock > 0 ? `${form.stock} unidades disponíveis` : "Sem estoque cadastrado"}</small></div>
            <div className="product-editor-summary-tip"><IconInfoCircle /><p><strong>Dica</strong>Fotos claras e com o mesmo enquadramento deixam o catálogo mais profissional.</p></div>
          </div>
        </aside>
      </div>
    </form>
  );
}
