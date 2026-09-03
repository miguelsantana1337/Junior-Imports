"use client";

import { Bookmark, Check, ChevronLeft, ChevronRight, Columns3, Eye, EyeOff, FileSpreadsheet, MoreVertical, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";
import { ProductArt } from "@/components/ui/product-art";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/types/store";
import { useAdminPreferences } from "./use-admin-preferences";
import { isElectronicsProduct, resolveStorefrontCatalogScope, type StorefrontCatalogScope } from "@/lib/storefront-catalog-scope";
import { adminCatalogHref, hasSeparateCatalogs } from "@/lib/admin-catalog-link";

const pageSize = 10;

export function ProductsAdmin() {
  const { data, currentUser, deleteProduct, moveItem, toggleItem } = useAdminData();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q") ?? "");
  const [category, setCategory] = useState("all");
  const [catalog, setCatalog] = useState<StorefrontCatalogScope>(() => searchParams.get("catalog") === "electronics" ? "electronics" : searchParams.get("catalog") === "pharmaceutical" ? "pharmaceutical" : "all");
  const [visibility, setVisibility] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [savingView, setSavingView] = useState(false);
  const [viewName, setViewName] = useState("");
  const { preferences, updatePreferences } = useAdminPreferences(currentUser.id);
  const router = useRouter();
  const separateCatalogs = hasSeparateCatalogs(data.tenant);
  const newProductHref = `/admin/products/new${catalog === "all" ? "" : `?catalog=${catalog}`}`;
  const catalogCategories = resolveStorefrontCatalogScope(data.products, data.categories, catalog).categories;
  useEffect(() => { if (searchParams.get("novo") === "1") router.replace(newProductHref); }, [router, searchParams, newProductHref]);
  useEffect(() => { const requested = searchParams.get("catalog"); setCatalog(requested === "electronics" || requested === "pharmaceutical" ? requested : "all"); setCategory("all"); }, [searchParams]);
  useEffect(() => { const externalQuery = searchParams.get("q"); if (externalQuery !== null) setQuery(externalQuery); }, [searchParams]);
  const products = useMemo(() => [...data.products]
    .sort((a, b) => a.order - b.order)
    .filter((product) => {
      const normalized = query.trim().toLocaleLowerCase("pt-BR");
      const matchesQuery = !normalized || `${product.name} ${product.sku} ${product.brand}`.toLocaleLowerCase("pt-BR").includes(normalized);
      return matchesQuery
        && (catalog === "all" || isElectronicsProduct(product, data.categories) === (catalog === "electronics"))
        && (category === "all" || product.categoryId === category)
        && (visibility === "all" || (visibility === "active" ? product.active : !product.active));
    }), [catalog, category, data.categories, data.products, query, visibility]);
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); setSelected([]); }, [catalog, category, query, visibility]);

  const askDelete = useCallback(async (product: Product) => {
    const accepted = await confirm({ title: "Excluir produto?", description: `“${product.name}” deixará de aparecer no painel e na loja. Pedidos, estoque e histórico financeiro serão preservados.`, confirmLabel: "Excluir produto", danger: true });
    if (accepted) await deleteProduct(product.id);
  }, [confirm, deleteProduct]);

  async function applyBulk(action: "show" | "hide" | "delete") {
    const targets = data.products.filter((product) => selected.includes(product.id));
    if (action === "delete") {
      const accepted = await confirm({ title: "Excluir produtos selecionados?", description: `${targets.length} produto(s) deixarão de aparecer no painel e na loja. O histórico será preservado.`, confirmLabel: "Excluir selecionados", danger: true });
      if (!accepted) return;
      for (const product of targets) await deleteProduct(product.id);
    } else {
      const active = action === "show";
      for (const product of targets) if (product.active !== active) await toggleItem("products", product.id);
    }
    setSelected([]);
  }

  function saveCurrentView() {
    const name = viewName.trim();
    if (!name) return;
    updatePreferences((current) => ({
      ...current,
      productViews: [
        { id: crypto.randomUUID(), name, query, category, catalog, visibility, createdAt: new Date().toISOString() },
        ...current.productViews,
      ],
    }));
    setViewName("");
    setSavingView(false);
  }

  return (
    <>
      {separateCatalogs && <nav className="admin-catalog-switch" aria-label="Filtrar produtos por catálogo">{(["all", "electronics", "pharmaceutical"] as const).map((scope) => <button key={scope} className={catalog === scope ? "active" : ""} aria-pressed={catalog === scope} onClick={() => { setCatalog(scope); setCategory("all"); }}><strong>{scope === "all" ? "Todos" : scope === "electronics" ? "Eletrônicos" : "Farmacêuticos"}</strong><small>{scope === "all" ? "Catálogo completo" : scope === "electronics" ? "Home principal" : "Subdomínio separado"}</small></button>)}</nav>}
      <AdminPanel title={catalog === "electronics" ? "Produtos eletrônicos" : catalog === "pharmaceutical" ? "Produtos farmacêuticos" : "Produtos"} description="Edite nomes, fotos, preços, estoque e destaques. As alterações aparecem no catálogo correspondente." action={<div className="admin-panel-actions"><Link className="admin-button" href="/admin/import"><FileSpreadsheet /> Importar planilha</Link><Link className="admin-button primary" href={newProductHref}><Plus /><span>Adicionar produto</span></Link></div>}>
        {separateCatalogs && catalog !== "all" && <div className="electronics-editor-help"><p>{catalog === "electronics" ? "Produtos da categoria Eletrônicos aparecem somente na home principal." : "Os demais produtos aparecem somente no catálogo farmacêutico."}</p><Link href={adminCatalogHref(data.tenant, catalog)} target="_blank" rel="noreferrer">Ver este catálogo →</Link>{catalog === "electronics" && <Link href="/admin/layout?catalog=electronics">Editar a home de eletrônicos →</Link>}</div>}
        <div className="admin-saved-views" aria-label="Visualizações salvas">
          <div><Bookmark /><strong>Visualizações</strong>{preferences.productViews.map((view) => <span className="admin-saved-view" key={view.id}><button onClick={() => { setQuery(view.query); setCategory(view.category); setCatalog(view.catalog ?? "all"); setVisibility(view.visibility); }}>{view.name}</button><button aria-label={`Excluir visualização ${view.name}`} onClick={() => updatePreferences((current) => ({ ...current, productViews: current.productViews.filter((item) => item.id !== view.id) }))}><X /></button></span>)}{!preferences.productViews.length && <small>Salve combinações de busca e filtros para reutilizar.</small>}</div>
          <div>
            {savingView ? <span className="admin-save-view-form"><input autoFocus value={viewName} maxLength={48} onChange={(event) => setViewName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") saveCurrentView(); if (event.key === "Escape") setSavingView(false); }} placeholder="Nome da visualização" aria-label="Nome da visualização" /><button onClick={saveCurrentView} disabled={!viewName.trim()} aria-label="Salvar visualização"><Check /></button><button onClick={() => setSavingView(false)} aria-label="Cancelar"><X /></button></span> : <button className="admin-view-action" onClick={() => setSavingView(true)}><Bookmark /> Salvar filtros</button>}
            <button className="admin-view-action" onClick={() => updatePreferences((current) => ({ ...current, tableDensity: current.tableDensity === "compact" ? "comfortable" : "compact" }))} aria-pressed={preferences.tableDensity === "compact"} title="Alternar densidade da tabela"><Columns3 /> {preferences.tableDensity === "compact" ? "Compacta" : "Confortável"}</button>
          </div>
        </div>
        <div className="admin-list-toolbar">
          <label className="admin-search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, SKU ou marca" aria-label="Buscar produtos" /></label>
          <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas</option>{catalogCategories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Visibilidade</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="hidden">Ocultos</option></select></label>
          <strong>{products.length} produto{products.length === 1 ? "" : "s"}</strong>
        </div>
        {selected.length > 0 && <div className="admin-bulk-bar"><strong>{selected.length} selecionado{selected.length === 1 ? "" : "s"}</strong><button onClick={() => applyBulk("show")}><Eye /> Exibir</button><button onClick={() => applyBulk("hide")}><EyeOff /> Ocultar</button><button className="danger" onClick={() => applyBulk("delete")}><Trash2 /> Excluir</button></div>}
        {visibleProducts.length ? (
          <>
            <div className={`admin-table-wrap admin-products-desktop ${preferences.tableDensity === "compact" ? "is-compact" : ""}`}>
              <table className="admin-table admin-products-table">
                <thead><tr><th><input type="checkbox" aria-label="Selecionar página" checked={visibleProducts.every((product) => selected.includes(product.id))} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...visibleProducts.map((product) => product.id)])] : selected.filter((id) => !visibleProducts.some((product) => product.id === id)))} /></th><th>Ordem</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>{visibleProducts.map((product) => {
                  const globalIndex = [...data.products].sort((a, b) => a.order - b.order).findIndex((item) => item.id === product.id);
                  return <tr key={product.id}><td><input type="checkbox" aria-label={`Selecionar ${product.name}`} checked={selected.includes(product.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id))} /></td><td><div className="order-buttons"><button aria-label={`Mover ${product.name} para cima`} disabled={globalIndex === 0} onClick={() => moveItem("products", product.id, -1)}>↑</button><button aria-label={`Mover ${product.name} para baixo`} disabled={globalIndex === data.products.length - 1} onClick={() => moveItem("products", product.id, 1)}>↓</button></div></td><td><div className="admin-product-cell"><div className="admin-product-thumb"><ProductArt product={product} /></div><div><Link className="admin-table-link" href={`/admin/products/${encodeURIComponent(product.id)}`}>{product.name}</Link><small>{product.sku}{product.brand ? ` · ${product.brand}` : ""}</small></div></div></td><td><span className="admin-category-tag">{product.category}</span></td><td><strong>{formatMoney(product.price)}</strong></td><td><span className={product.stock <= 10 ? "admin-stock-count is-low" : "admin-stock-count"}>{product.stock}</span></td><td><StatusTag active={product.active}>{product.active ? "Visível" : "Oculto"}</StatusTag></td><td><div className="admin-actions"><button aria-label={product.active ? `Ocultar ${product.name}` : `Exibir ${product.name}`} onClick={() => toggleItem("products", product.id)}>{product.active ? <EyeOff /> : <Eye />}</button><Link aria-label={`Editar ${product.name}`} href={`/admin/products/${encodeURIComponent(product.id)}`}><Pencil /></Link><button className="danger" aria-label={`Excluir ${product.name}`} onClick={() => askDelete(product)}><Trash2 /></button></div></td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="admin-mobile-cards admin-products-mobile-list">{visibleProducts.map((product) => <article className="admin-product-mobile-card" key={product.id}>
              <header>
                <div className="admin-product-cell"><div className="admin-product-thumb"><ProductArt product={product} /></div><div><Link className="admin-table-link" href={`/admin/products/${encodeURIComponent(product.id)}`}>{product.name}</Link><small>{product.sku}{product.brand ? ` · ${product.brand}` : ""}</small></div></div>
                <Link className="admin-mobile-kebab" aria-label={`Editar ${product.name}`} href={`/admin/products/${encodeURIComponent(product.id)}`}><MoreVertical /></Link>
              </header>
              <div className="admin-product-mobile-details"><span><b>{product.stock}</b> em estoque</span><span>{product.category}</span></div>
              <footer><strong>{formatMoney(product.price)}</strong><StatusTag active={product.active}>{product.active ? "Visível" : "Oculto"}</StatusTag></footer>
            </article>)}</div>
            <div className="admin-pagination"><span>Página {currentPage} de {pageCount}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior"><ChevronLeft /></button><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Próxima página"><ChevronRight /></button></div></div>
          </>
        ) : <AdminEmpty><strong>Nenhum produto encontrado.</strong><span>Ajuste os filtros ou adicione um novo produto.</span></AdminEmpty>}
      </AdminPanel>
    </>
  );
}
