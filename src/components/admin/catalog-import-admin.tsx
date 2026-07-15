"use client";

import { AlertCircle, CheckCircle2, Download, FileSpreadsheet, History, PackagePlus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { productImportTemplate, stockImportTemplate, parseProductImport, parseStockImport, type ImportError, type StockImportRow } from "@/lib/catalog-import";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { Product, StockImportMode } from "@/types/store";
import { useAdminData } from "./admin-data-provider";
import { AdminEmpty, AdminPanel, StatusTag } from "./admin-ui";

type Preview = {
  filename: string;
  products: Product[];
  stockRows: StockImportRow[];
  errors: ImportError[];
  totalRows: number;
};

function downloadTemplate(kind: "products" | "stock") {
  const content = kind === "products" ? productImportTemplate : stockImportTemplate;
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = kind === "products" ? "modelo-produtos-junior-imports.csv" : "modelo-estoque-junior-imports.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function CatalogImportAdmin() {
  const { data, importProducts, importStock } = useAdminData();
  const [kind, setKind] = useState<"products" | "stock">("products");
  const [stockMode, setStockMode] = useState<StockImportMode>("replace");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const validRows = preview ? (kind === "products" ? preview.products.length : preview.stockRows.length) : 0;
  const categoryNames = useMemo(() => data.categories.map((category) => category.name).join(", "), [data.categories]);

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result);
      const result = kind === "products"
        ? parseProductImport(text, data.products, data.categories)
        : parseStockImport(text, data.products);
      setPreview({ filename: file.name, products: "products" in result ? result.products : [], stockRows: "rows" in result ? result.rows : [], errors: result.errors, totalRows: result.totalRows });
    };
    reader.readAsText(file, "utf-8");
  }

  async function confirmImport() {
    if (!preview || preview.errors.length || !validRows) return;
    setImporting(true);
    try {
      if (kind === "products") await importProducts(preview.products, preview.filename);
      else await importStock(preview.stockRows, stockMode, preview.filename);
      setPreview(null);
    } finally { setImporting(false); }
  }

  return <>
    <div className="catalog-import-tabs" role="tablist" aria-label="Tipo de importação"><button className={kind === "products" ? "active" : ""} onClick={() => { setKind("products"); setPreview(null); }}><PackagePlus /> Produtos em massa</button><button className={kind === "stock" ? "active" : ""} onClick={() => { setKind("stock"); setPreview(null); }}><FileSpreadsheet /> Atualizar estoque</button></div>

    <AdminPanel title={kind === "products" ? "Cadastrar e atualizar produtos por planilha" : "Movimentar estoque por planilha"} description="Use um arquivo CSV compatível com Excel. O SKU identifica produtos existentes e evita duplicações.">
      <div className="import-workflow-grid">
        <article className="import-step-card"><span>1</span><Download /><h3>Baixe o modelo</h3><p>{kind === "products" ? "O arquivo contém todas as colunas aceitas no cadastro." : "Preencha somente o SKU e a quantidade."}</p><button className="admin-button" onClick={() => downloadTemplate(kind)}><Download /> Baixar modelo CSV</button></article>
        <article className="import-step-card"><span>2</span><FileSpreadsheet /><h3>Preencha no Excel</h3><p>{kind === "products" ? `Use uma categoria existente: ${categoryNames || "cadastre uma categoria primeiro"}.` : "Não altere o SKU do produto."}</p>{kind === "stock" && <label>Como aplicar a quantidade<select value={stockMode} onChange={(event) => setStockMode(event.target.value as StockImportMode)}><option value="replace">Substituir estoque atual</option><option value="increment">Somar ao estoque</option><option value="decrement">Retirar do estoque</option></select></label>}</article>
        <article className="import-step-card upload"><span>3</span><Upload /><h3>Envie e revise</h3><p>Nada será salvo antes da confirmação da prévia.</p><button className="admin-button primary" onClick={() => fileRef.current?.click()}><Upload /> Selecionar planilha</button><input ref={fileRef} hidden type="file" accept=".csv,text/csv,text/plain" onChange={(event) => { const file = event.target.files?.[0]; if (file) readFile(file); event.target.value = ""; }} /></article>
      </div>

      {preview && <section className="import-preview"><header><div><span>PRÉVIA DA IMPORTAÇÃO</span><h3>{preview.filename}</h3><p>{preview.totalRows} linha{preview.totalRows === 1 ? "" : "s"} lida{preview.totalRows === 1 ? "" : "s"} · {validRows} pronta{validRows === 1 ? "" : "s"} · {preview.errors.length} com erro</p></div><StatusTag active={!preview.errors.length}>{preview.errors.length ? "Revisar arquivo" : "Pronto para importar"}</StatusTag></header>
        {preview.errors.length > 0 && <div className="import-errors" role="alert"><strong><AlertCircle /> Corrija estas linhas antes de continuar</strong>{preview.errors.slice(0, 20).map((error) => <p key={`${error.row}-${error.message}`}>Linha {error.row}: {error.message}</p>)}</div>}
        {validRows > 0 && <div className="admin-table-wrap"><table className="admin-table"><thead><tr>{kind === "products" ? <><th>SKU</th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Publicação</th></> : <><th>SKU</th><th>Produto</th><th>Atual</th><th>Quantidade</th><th>Resultado</th></>}</tr></thead><tbody>{kind === "products" ? preview.products.slice(0, 12).map((product) => <tr key={product.sku}><td><strong>{product.sku}</strong></td><td>{product.name}</td><td>{product.category}</td><td>{formatMoney(product.price)}</td><td>{product.stock}</td><td>{product.active ? "Ativo" : "Oculto"}</td></tr>) : preview.stockRows.slice(0, 12).map((row) => { const product = data.products.find((item) => item.sku.toUpperCase() === row.sku.toUpperCase())!; const result = stockMode === "replace" ? row.quantity : stockMode === "increment" ? product.stock + row.quantity : Math.max(0, product.stock - row.quantity); return <tr key={row.sku}><td><strong>{row.sku}</strong></td><td>{product.name}</td><td>{product.stock}</td><td>{stockMode === "decrement" ? "-" : stockMode === "increment" ? "+" : ""}{row.quantity}</td><td><strong>{result}</strong></td></tr>; })}</tbody></table></div>}
        <footer><p><CheckCircle2 /> A importação só será confirmada se todas as linhas estiverem válidas.</p><button className="admin-button primary" disabled={importing || preview.errors.length > 0 || validRows === 0} onClick={confirmImport}>{importing ? "Importando..." : `Confirmar ${validRows} linha${validRows === 1 ? "" : "s"}`}</button></footer>
      </section>}
    </AdminPanel>

    <AdminPanel title="Histórico de importações" description="Registro das últimas planilhas processadas pela equipe.">
      {data.catalogImports.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Data</th><th>Arquivo</th><th>Tipo</th><th>Modo</th><th>Resultado</th><th>Usuário</th></tr></thead><tbody>{data.catalogImports.map((run) => <tr key={run.id}><td>{formatDateTime(run.createdAt)}</td><td><strong>{run.filename}</strong></td><td>{run.kind === "products" ? "Produtos" : "Estoque"}</td><td>{run.mode === "upsert" ? "Cadastrar/atualizar" : run.mode === "replace" ? "Substituir" : run.mode === "increment" ? "Somar" : "Retirar"}</td><td>{run.successRows} processadas · {run.errorRows} erros</td><td>{run.actorEmail || "Equipe"}</td></tr>)}</tbody></table></div> : <AdminEmpty><History /><strong>Nenhuma importação realizada.</strong><span>O histórico aparecerá após a primeira planilha confirmada.</span></AdminEmpty>}
    </AdminPanel>
  </>;
}
