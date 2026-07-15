"use client";

import { Building2, ExternalLink, Loader2, LogOut, Plus, Settings2, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { SaasTenant } from "@/types/store";

type TenantForm = {
  name: string;
  slug: string;
  whatsapp: string;
  email: string;
  primaryColor: string;
  orderPrefix: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
};

const initialForm: TenantForm = {
  name: "",
  slug: "",
  whatsapp: "",
  email: "",
  primaryColor: "#1677ff",
  orderPrefix: "",
  ownerName: "",
  ownerEmail: "",
  ownerPassword: "",
};

function slugify(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function makePrefix(value: string) {
  const words = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").match(/[A-Za-z0-9]+/g) ?? [];
  return (words.length > 1 ? words.map((word) => word[0]).join("") : words[0]?.slice(0, 3) ?? "").toUpperCase().slice(0, 5);
}

export function SaasConsole({ actorName }: { actorName: string }) {
  const [tenants, setTenants] = useState<SaasTenant[]>([]);
  const [form, setForm] = useState(initialForm);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/platform/tenants", { cache: "no-store" });
    const payload = await response.json().catch(() => ({})) as { tenants?: SaasTenant[]; error?: string };
    setLoading(false);
    if (!response.ok) { setError(payload.error ?? "Não foi possível carregar os clientes."); return; }
    setTenants(payload.tenants ?? []);
    setError("");
  }, []);

  useEffect(() => { void load(); }, [load]);

  function field<K extends keyof TenantForm>(key: K, value: TenantForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function createTenant(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError("");
    const response = await fetch("/api/platform/tenants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    setCreating(false);
    if (!response.ok) { setError(payload.error ?? "Não foi possível criar o cliente."); return; }
    setForm(initialForm);
    setShowForm(false);
    await load();
  }

  async function openAdmin(tenant: SaasTenant) {
    setError("");
    const response = await fetch("/api/platform/tenants/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: tenant.slug }) });
    if (!response.ok) { const payload = await response.json().catch(() => ({})) as { error?: string }; setError(payload.error ?? "Não foi possível abrir o cliente."); return; }
    window.location.assign("/admin");
  }

  async function updateTenant(tenant: SaasTenant, patch: Pick<SaasTenant, "status" | "plan">) {
    const next = { ...tenant, ...patch };
    setTenants((current) => current.map((item) => item.id === tenant.id ? next : item));
    const response = await fetch("/api/platform/tenants", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: tenant.id, status: next.status, plan: next.plan }) });
    if (!response.ok) { setError("A alteração não foi salva."); await load(); }
  }

  return (
    <main className="saas-console">
      <header className="saas-topbar">
        <div><span>WHITE-LABEL COMMERCE</span><h1>Clientes da plataforma</h1><p>Olá, {actorName}. Crie e opere todas as lojas a partir de uma única instalação.</p></div>
        <div><button className="button button-primary" onClick={() => setShowForm((value) => !value)}><Plus /> Novo cliente</button><Link className="button button-ghost" href="/admin"><Settings2 /> Painel da loja</Link><Link className="button button-ghost" href="/admin/login"><LogOut /> Conta</Link></div>
      </header>

      {error && <p className="saas-error" role="alert">{error}</p>}

      {showForm && <form className="saas-create-card" onSubmit={createTenant}>
        <header><Building2 /><div><h2>Provisionar nova loja</h2><p>O sistema criará o tenant, o catálogo inicial, o painel e o usuário proprietário.</p></div></header>
        <div className="saas-form-grid">
          <label>Nome da empresa<input required value={form.name} onChange={(event) => { const name = event.target.value; setForm((current) => ({ ...current, name, slug: slugify(name), orderPrefix: makePrefix(name) })); }} placeholder="Autêntica" /></label>
          <label>Endereço da loja<input required value={form.slug} onChange={(event) => field("slug", slugify(event.target.value))} placeholder="autentica" /><small>/loja/{form.slug || "cliente"}</small></label>
          <label>WhatsApp<input required value={form.whatsapp} onChange={(event) => field("whatsapp", event.target.value)} placeholder="5531999999999" /></label>
          <label>E-mail comercial<input required type="email" value={form.email} onChange={(event) => field("email", event.target.value)} /></label>
          <label>Prefixo dos pedidos<input required maxLength={5} value={form.orderPrefix} onChange={(event) => field("orderPrefix", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="AUT" /></label>
          <label>Cor principal<input type="color" value={form.primaryColor} onChange={(event) => field("primaryColor", event.target.value)} /></label>
          <label>Nome do responsável<input required value={form.ownerName} onChange={(event) => field("ownerName", event.target.value)} /></label>
          <label>E-mail de acesso<input required type="email" value={form.ownerEmail} onChange={(event) => field("ownerEmail", event.target.value)} /></label>
          <label>Senha temporária<input required minLength={8} type="password" value={form.ownerPassword} onChange={(event) => field("ownerPassword", event.target.value)} /></label>
        </div>
        <footer><button className="button button-ghost" type="button" onClick={() => setShowForm(false)}>Cancelar</button><button className="button button-primary" disabled={creating}>{creating ? <Loader2 className="spin" /> : <Plus />} Criar cliente</button></footer>
      </form>}

      <section className="saas-summary">
        <article><span>Clientes</span><strong>{tenants.length}</strong></article>
        <article><span>Ativos</span><strong>{tenants.filter((tenant) => tenant.status === "active").length}</strong></article>
        <article><span>Em implantação</span><strong>{tenants.filter((tenant) => tenant.status === "trial").length}</strong></article>
        <article><span>Plano Pro/Scale</span><strong>{tenants.filter((tenant) => tenant.plan !== "starter").length}</strong></article>
      </section>

      <section className="saas-tenants">
        <header><div><h2>Lojas cadastradas</h2><p>Cada loja possui dados, equipe e WhatsApp isolados.</p></div></header>
        {loading ? <div className="saas-loading"><Loader2 className="spin" /> Carregando clientes...</div> : tenants.length === 0 ? <div className="saas-empty"><Store /><h3>Nenhum cliente cadastrado</h3><p>Crie a primeira loja white-label.</p></div> : <div className="saas-tenant-grid">{tenants.map((tenant) => <article className="saas-tenant-card" key={tenant.id}>
          <div className="saas-tenant-brand" style={{ background: tenant.status === "suspended" ? "#64748b" : "#1677ff" }}>{tenant.name.slice(0, 2).toUpperCase()}</div>
          <div className="saas-tenant-main"><span className={`saas-status status-${tenant.status}`}>{tenant.status === "active" ? "Ativo" : tenant.status === "trial" ? "Implantação" : "Suspenso"}</span><h3>{tenant.name}</h3><p>/loja/{tenant.slug}</p></div>
          <div className="saas-tenant-controls"><label>Plano<select value={tenant.plan} onChange={(event) => void updateTenant(tenant, { status: tenant.status, plan: event.target.value as SaasTenant["plan"] })}><option value="starter">Starter</option><option value="pro">Pro</option><option value="scale">Scale</option></select></label><label>Status<select value={tenant.status} onChange={(event) => void updateTenant(tenant, { plan: tenant.plan, status: event.target.value as SaasTenant["status"] })}><option value="trial">Implantação</option><option value="active">Ativo</option><option value="suspended">Suspenso</option></select></label></div>
          <footer><button onClick={() => void openAdmin(tenant)}><Settings2 /> Gerenciar</button><Link href={`/loja/${tenant.slug}`} target="_blank"><ExternalLink /> Ver loja</Link></footer>
        </article>)}</div>}
      </section>
    </main>
  );
}
