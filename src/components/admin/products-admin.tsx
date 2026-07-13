"use client";

import { Eye, EyeOff, ImagePlus, Pencil, Plus, Trash2, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import { ProductArt } from "@/components/ui/product-art";
import { formatMoney, slugify } from "@/lib/format";
import { productSchema } from "@/lib/validation";
import type { Product } from "@/types/store";

export function ProductsAdmin() {
  const { data, deleteProduct, moveItem, toggleItem } = useAdminData();
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const searchParams = useSearchParams();
  useEffect(() => { if (searchParams.get("novo") === "1") setEditing("new"); }, [searchParams]);
  const products = [...data.products].sort((a, b) => a.order - b.order);
  return <><AdminPanel title="Catálogo de produtos" description="Adicione, edite, oculte e defina a ordem de exibição." action={<button className="admin-button primary" onClick={() => setEditing("new")}><Plus /> Adicionar produto</button>}><div className="admin-table-wrap"><table className="admin-table admin-products-table"><thead><tr><th>Ordem</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Destaque</th><th>Status</th><th>Ações</th></tr></thead><tbody>{products.map((product, index) => <tr key={product.id}><td><div className="order-buttons"><button disabled={index === 0} onClick={() => moveItem("products", product.id, -1)}>↑</button><button disabled={index === products.length - 1} onClick={() => moveItem("products", product.id, 1)}>↓</button></div></td><td><div className="admin-product-cell"><div className="admin-product-thumb"><ProductArt product={product} /></div><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category}</td><td>{formatMoney(product.price)}</td><td>{product.stock}</td><td>{product.featured ? "Sim" : "Não"}</td><td><StatusTag active={product.active}>{product.active ? "Ativo" : "Oculto"}</StatusTag></td><td><div className="admin-actions"><button title={product.active ? "Ocultar" : "Exibir"} onClick={() => toggleItem("products", product.id)}>{product.active ? <EyeOff /> : <Eye />}</button><button title="Editar" onClick={() => setEditing(product)}><Pencil /></button><button className="danger" title="Excluir" onClick={() => window.confirm("Excluir este produto?") && deleteProduct(product.id)}><Trash2 /></button></div></td></tr>)}</tbody></table></div></AdminPanel>{editing && <ProductEditor product={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</>;
}

function ProductEditor({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const { data, saveProduct, uploadMedia } = useAdminData();
  const category = data.categories.find((item) => item.id === product?.categoryId) ?? data.categories[0];
  const [form, setForm] = useState<Product>(product ?? { id: crypto.randomUUID(), slug: "", name: "", categoryId: category?.id ?? "", category: category?.name ?? "", brand: "", price: 0, compareAt: 0, stock: 0, badge: "", accent: "#1677ff", description: "", sku: `JI-${String(data.products.length + 1).padStart(3, "0")}`, rating: 5, reviews: 0, featured: false, active: true, order: data.products.length + 1, imageUrl: "" });
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  function field<K extends keyof Product>(key: K, value: Product[K]) { setForm((current) => ({ ...current, [key]: value })); }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = productSchema.safeParse(form);
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; }
    const selectedCategory = data.categories.find((item) => item.id === form.categoryId)!;
    await saveProduct({ ...form, slug: slugify(form.name), category: selectedCategory.name });
    onClose();
  }
  return <div className="admin-modal" role="dialog" aria-modal="true" aria-label={product ? "Editar produto" : "Novo produto"}><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel"><header><div><span>PRODUTOS</span><h2>{product ? "Editar produto" : "Novo produto"}</h2></div><button onClick={onClose}><X /></button></header><form className="admin-form" onSubmit={submit}><label>Nome<input value={form.name} onChange={(event) => field("name", event.target.value)} required /></label><label>SKU<input value={form.sku} onChange={(event) => field("sku", event.target.value)} required /></label><label>Categoria<select value={form.categoryId} onChange={(event) => field("categoryId", event.target.value)}>{data.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Marca<input value={form.brand} onChange={(event) => field("brand", event.target.value)} required /></label><label>Preço<input type="number" step="0.01" min="0" value={form.price} onChange={(event) => field("price", Number(event.target.value))} /></label><label>Preço anterior<input type="number" step="0.01" min="0" value={form.compareAt} onChange={(event) => field("compareAt", Number(event.target.value))} /></label><label>Estoque<input type="number" min="0" value={form.stock} onChange={(event) => field("stock", Number(event.target.value))} /></label><label>Etiqueta<input value={form.badge} onChange={(event) => field("badge", event.target.value)} /></label><label>Avaliação<input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(event) => field("rating", Number(event.target.value))} /></label><label>Nº de avaliações<input type="number" min="0" value={form.reviews} onChange={(event) => field("reviews", Number(event.target.value))} /></label><label>Cor do mockup<input type="color" value={form.accent} onChange={(event) => field("accent", event.target.value)} /></label><label>URL da imagem<input value={form.imageUrl} onChange={(event) => field("imageUrl", event.target.value)} placeholder="https://..." /></label><label className="full upload-label"><ImagePlus /> {uploading ? "Enviando..." : "Enviar imagem"}<input type="file" accept="image/*" disabled={uploading} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); try { field("imageUrl", await uploadMedia(file, "product-media")); } finally { setUploading(false); } }} /></label><label className="full">Descrição<textarea value={form.description} onChange={(event) => field("description", event.target.value)} /></label><label className="check-field"><input type="checkbox" checked={form.featured} onChange={(event) => field("featured", event.target.checked)} /> Produto em destaque</label><label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => field("active", event.target.checked)} /> Produto visível</label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" type="submit">Salvar produto</button></div></form></div></div>;
}
