"use client";

import { Eye, EyeOff, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import { categorySchema } from "@/lib/validation";
import { slugify } from "@/lib/format";
import type { Category } from "@/types/store";

export function CategoriesAdmin() {
  const { data, deleteCategory, moveItem, toggleItem } = useAdminData();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const categories = [...data.categories].sort((a, b) => a.order - b.order);
  return <><AdminPanel title="Categorias" description="Defina nomes, ordem e disponibilidade nos filtros." action={<button className="admin-button primary" onClick={() => setEditing("new")}><Plus /> Adicionar categoria</button>}><div className="admin-list">{categories.map((category, index) => <article className="sortable-row" key={category.id}><div className="order-buttons"><button disabled={index === 0} onClick={() => moveItem("categories", category.id, -1)}>↑</button><button disabled={index === categories.length - 1} onClick={() => moveItem("categories", category.id, 1)}>↓</button></div><div className="sortable-main"><strong>{category.name}</strong><small>{data.products.filter((product) => product.categoryId === category.id).length} produtos · <StatusTag active={category.active}>{category.active ? "Visível" : "Oculta"}</StatusTag></small></div><div className="admin-actions"><button onClick={() => toggleItem("categories", category.id)}>{category.active ? <EyeOff /> : <Eye />}</button><button onClick={() => setEditing(category)}><Pencil /></button><button className="danger" onClick={() => window.confirm("Excluir esta categoria?") && deleteCategory(category.id)}><Trash2 /></button></div></article>)}</div></AdminPanel>{editing && <CategoryEditor category={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}</>;
}

function CategoryEditor({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { data, saveCategory } = useAdminData();
  const [form, setForm] = useState<Category>(category ?? { id: crypto.randomUUID(), name: "", slug: "", active: true, order: data.categories.length + 1 });
  const [error, setError] = useState("");
  return <div className="admin-modal" role="dialog" aria-modal="true"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel small"><header><div><span>CATEGORIAS</span><h2>{category ? "Editar categoria" : "Nova categoria"}</h2></div><button onClick={onClose}><X /></button></header><form className="admin-form" onSubmit={async (event) => { event.preventDefault(); const parsed = categorySchema.safeParse(form); if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os campos."); return; } await saveCategory({ ...form, slug: slugify(form.name) }); onClose(); }}><label className="full">Nome<input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="check-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Categoria visivel</label>{error && <p className="admin-form-error full">{error}</p>}<div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary">Salvar categoria</button></div></form></div></div>;
}
