"use client";

import { ChevronLeft, ChevronRight, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";
import { ProductArt } from "@/components/ui/product-art";
import { useConfirm } from "@/components/providers/confirm-provider";
import { formatMoney } from "@/lib/format";
import type { Product } from "@/types/store";

const pageSize = 10;

export function ProductsAdmin() {
  const { data, deleteProduct, moveItem, toggleItem } = useAdminData();
  const confirm = useConfirm();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [visibility, setVisibility] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => { if (searchParams.get("novo") === "1") router.replace("/admin/products/new"); }, [router, searchParams]);
  const products = useMemo(() => [...data.products]
    .sort((a, b) => a.order - b.order)
    .filter((product) => {
      const normalized = query.trim().toLocaleLowerCase("pt-BR");
      const matchesQuery = !normalized || `${product.name} ${product.sku} ${product.brand}`.toLocaleLowerCase("pt-BR").includes(normalized);
      return matchesQuery
        && (category === "all" || product.categoryId === category)
        && (visibility === "all" || (visibility === "active" ? product.active : !product.active));
    }), [category, data.products, query, visibility]);
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleProducts = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setPage(1); setSelected([]); }, [category, query, visibility]);

  const askDelete = useCallback(async (product: Product) => {
    const accepted = await confirm({ title: "Excluir produto?", description: `“${product.name}” será removido permanentemente do catálogo.`, confirmLabel: "Excluir produto", danger: true });
    if (accepted) await deleteProduct(product.id);
  }, [confirm, deleteProduct]);

  async function applyBulk(action: "show" | "hide" | "delete") {
    const targets = data.products.filter((product) => selected.includes(product.id));
    if (action === "delete") {
      const accepted = await confirm({ title: "Excluir produtos selecionados?", description: `${targets.length} produto(s) serão removidos permanentemente.`, confirmLabel: "Excluir selecionados", danger: true });
      if (!accepted) return;
      for (const product of targets) await deleteProduct(product.id);
    } else {
      const active = action === "show";
      for (const product of targets) if (product.active !== active) await toggleItem("products", product.id);
    }
    setSelected([]);
  }

  return (
    <>
      <AdminPanel title="Catálogo de produtos" description="Pesquise, filtre, edite, oculte e defina a ordem de exibição." action={<Link className="admin-button primary" href="/admin/products/new"><Plus /> Adicionar produto</Link>}>
        <div className="admin-list-toolbar">
          <label className="admin-search-field"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, SKU ou marca" aria-label="Buscar produtos" /></label>
          <label><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">Todas</option>{data.categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Visibilidade</span><select value={visibility} onChange={(event) => setVisibility(event.target.value)}><option value="all">Todos</option><option value="active">Ativos</option><option value="hidden">Ocultos</option></select></label>
          <strong>{products.length} produto{products.length === 1 ? "" : "s"}</strong>
        </div>
        {selected.length > 0 && <div className="admin-bulk-bar"><strong>{selected.length} selecionado{selected.length === 1 ? "" : "s"}</strong><button onClick={() => applyBulk("show")}><Eye /> Exibir</button><button onClick={() => applyBulk("hide")}><EyeOff /> Ocultar</button><button className="danger" onClick={() => applyBulk("delete")}><Trash2 /> Excluir</button></div>}
        {visibleProducts.length ? (
          <>
            <div className="admin-table-wrap admin-products-desktop">
              <table className="admin-table admin-products-table">
                <thead><tr><th><input type="checkbox" aria-label="Selecionar página" checked={visibleProducts.every((product) => selected.includes(product.id))} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...visibleProducts.map((product) => product.id)])] : selected.filter((id) => !visibleProducts.some((product) => product.id === id)))} /></th><th>Ordem</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead>
                <tbody>{visibleProducts.map((product) => {
                  const globalIndex = [...data.products].sort((a, b) => a.order - b.order).findIndex((item) => item.id === product.id);
                  return <tr key={product.id}><td><input type="checkbox" aria-label={`Selecionar ${product.name}`} checked={selected.includes(product.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, product.id] : selected.filter((id) => id !== product.id))} /></td><td><div className="order-buttons"><button aria-label={`Mover ${product.name} para cima`} disabled={globalIndex === 0} onClick={() => moveItem("products", product.id, -1)}>↑</button><button aria-label={`Mover ${product.name} para baixo`} disabled={globalIndex === data.products.length - 1} onClick={() => moveItem("products", product.id, 1)}>↓</button></div></td><td><div className="admin-product-cell"><div className="admin-product-thumb"><ProductArt product={product} /></div><div><strong>{product.name}</strong><small>{product.sku}</small></div></div></td><td>{product.category}</td><td>{formatMoney(product.price)}</td><td>{product.stock}</td><td><StatusTag active={product.active}>{product.active ? "Visível" : "Oculto"}</StatusTag></td><td><div className="admin-actions"><button aria-label={product.active ? `Ocultar ${product.name}` : `Exibir ${product.name}`} onClick={() => toggleItem("products", product.id)}>{product.active ? <EyeOff /> : <Eye />}</button><Link aria-label={`Editar ${product.name}`} href={`/admin/products/${encodeURIComponent(product.id)}`}><Pencil /></Link><button className="danger" aria-label={`Excluir ${product.name}`} onClick={() => askDelete(product)}><Trash2 /></button></div></td></tr>;
                })}</tbody>
              </table>
            </div>
            <div className="admin-mobile-cards">{visibleProducts.map((product) => <article key={product.id}><div className="admin-product-cell"><div className="admin-product-thumb"><ProductArt product={product} /></div><div><strong>{product.name}</strong><small>{product.sku} · {product.category}</small></div></div><dl><div><dt>Preço</dt><dd>{formatMoney(product.price)}</dd></div><div><dt>Estoque</dt><dd>{product.stock}</dd></div></dl><footer><StatusTag active={product.active}>{product.active ? "Visível" : "Oculto"}</StatusTag><div className="admin-actions"><button aria-label={product.active ? `Ocultar ${product.name}` : `Exibir ${product.name}`} onClick={() => toggleItem("products", product.id)}>{product.active ? <EyeOff /> : <Eye />}</button><Link aria-label={`Editar ${product.name}`} href={`/admin/products/${encodeURIComponent(product.id)}`}><Pencil /></Link><button className="danger" aria-label={`Excluir ${product.name}`} onClick={() => askDelete(product)}><Trash2 /></button></div></footer></article>)}</div>
            <div className="admin-pagination"><span>Página {currentPage} de {pageCount}</span><div><button disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior"><ChevronLeft /></button><button disabled={currentPage === pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Próxima página"><ChevronRight /></button></div></div>
          </>
        ) : <AdminEmpty><strong>Nenhum produto encontrado.</strong><span>Ajuste os filtros ou adicione um novo produto.</span></AdminEmpty>}
      </AdminPanel>
    </>
  );
}
