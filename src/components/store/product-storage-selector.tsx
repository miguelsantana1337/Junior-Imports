import { Check } from "lucide-react";
import Link from "next/link";
import type { CatalogProductSelection } from "@/lib/catalog-view";
import { stockLabel } from "@/lib/commerce";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function ProductStorageSelector({ selection, productId, storefrontPath }: {
  selection: CatalogProductSelection;
  productId: string;
  storefrontPath: string;
}) {
  return (
    <section className="product-storage-selector" aria-labelledby="product-storage-title">
      <h2 id="product-storage-title">Escolha o armazenamento</h2>
      <p>O preço e a disponibilidade são específicos de cada opção.</p>
      <nav className="product-storage-options" aria-label="Opções de armazenamento">
        {selection.options.map(({ label, product }) => {
          const selected = product.id === productId;
          const availability = product.regulatoryStatus === "blocked" ? "Indisponível" : product.stock <= 0 ? "Esgotado" : stockLabel(product).label;
          return <Link
            key={product.id}
            href={withStorefrontPath(storefrontPath, `/produtos/${product.slug}`)}
            scroll={false}
            aria-current={selected ? "true" : undefined}
            aria-label={`${label}, ${formatMoney(product.price)}, ${availability}${selected ? ", selecionado" : ""}`}
            className={`product-storage-option${selected ? " selected" : ""}`}
          >
            <span className="product-storage-label"><strong>{label}</strong>{selected && <Check aria-hidden="true" />}</span>
            <b>{formatMoney(product.price)}</b>
            <small>{availability}</small>
          </Link>;
        })}
      </nav>
    </section>
  );
}
