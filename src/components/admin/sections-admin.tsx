"use client";

import { Eye, EyeOff, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminPanel, StatusTag } from "./admin-ui";
import type { HomeSection } from "@/types/store";

export function SectionsAdmin() {
  const { data, moveItem, toggleItem } = useAdminData();
  const [editing, setEditing] = useState<HomeSection | null>(null);
  const sections = [...data.sections].sort((a, b) => a.order - b.order);
  return <><AdminPanel title="Ordem da página inicial" description="Reorganize, edite e oculte seções completas da vitrine."><div className="admin-list">{sections.map((section, index) => <article className="sortable-row" key={section.id}><div className="order-buttons"><button disabled={index === 0} onClick={() => moveItem("sections", section.id, -1)}>↑</button><button disabled={index === sections.length - 1} onClick={() => moveItem("sections", section.id, 1)}>↓</button></div><div className="sortable-main"><strong>{section.name}</strong><small>Posição {section.order} · <StatusTag active={section.active}>{section.active ? "Visível" : "Oculta"}</StatusTag></small></div><div className="admin-actions"><button onClick={() => toggleItem("sections", section.id)}>{section.active ? <EyeOff /> : <Eye />}</button><button onClick={() => setEditing(section)}><Pencil /></button></div></article>)}</div></AdminPanel>{editing && <SectionEditor section={editing} onClose={() => setEditing(null)} />}</>;
}

function SectionEditor({ section, onClose }: { section: HomeSection; onClose: () => void }) {
  const { saveSection } = useAdminData();
  const [form, setForm] = useState(section);
  function field<K extends keyof HomeSection>(key: K, value: HomeSection[K]) { setForm((current) => ({ ...current, [key]: value })); }
  return <div className="admin-modal" role="dialog" aria-modal="true"><button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" /><div className="admin-modal-panel"><header><div><span>PÁGINA INICIAL</span><h2>Editar {section.name}</h2></div><button onClick={onClose}><X /></button></header><form className="admin-form" onSubmit={async (event) => { event.preventDefault(); await saveSection(form); onClose(); }}><label>Chamada superior<input value={form.eyebrow} onChange={(event) => field("eyebrow", event.target.value)} /></label><label>Nome interno<input value={form.name} onChange={(event) => field("name", event.target.value)} /></label><label className="full">Título<input value={form.title} onChange={(event) => field("title", event.target.value)} /></label><label className="full">Subtítulo<textarea value={form.subtitle} onChange={(event) => field("subtitle", event.target.value)} /></label>{section.kind === "promo" && <><label>Texto do botão<input value={form.buttonText ?? ""} onChange={(event) => field("buttonText", event.target.value)} /></label><label>Link do botão<input value={form.buttonLink ?? ""} onChange={(event) => field("buttonLink", event.target.value)} /></label></>}<div className="admin-form-actions full"><button className="admin-button" type="button" onClick={onClose}>Cancelar</button><button className="admin-button primary">Salvar seção</button></div></form></div></div>;
}
