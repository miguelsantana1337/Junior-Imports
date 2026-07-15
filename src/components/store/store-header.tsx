"use client";

import { Menu, Search, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { Logo } from "@/components/ui/logo";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function StoreHeader() {
  const { data } = useStore();
  const { itemCount, setDrawerOpen } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const navigationPages = data.pages.filter((page) => page.active && page.showInNavigation && !page.isHome).sort((a, b) => a.order - b.order);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const shippingValue = formatMoney(data.settings.freeShippingThreshold);
  const announcement = data.settings.announcement
    .replaceAll("{{valor}}", shippingValue)
    .replace(/(frete grátis.*?acima de)\s*R\$\s*[\d.,]+/i, `$1 ${shippingValue}`);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (pathname === (data.tenant.storefrontPath || "/")) {
      window.dispatchEvent(new CustomEvent("junior-search", { detail: query }));
      document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`${storeHref("/")}?q=${encodeURIComponent(query)}#catalogo`);
    }
  }

  return (
    <>
      <div className="announcement">
        <div className="container announcement-inner">
          <span>{announcement}</span>
          <Link href={storeHref("/#catalogo")}>Ver ofertas →</Link>
        </div>
      </div>
      <header className="store-header">
        <div className="container header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Navegacao principal">
            <Link href={storeHref("/#destaques")}>Destaques</Link>
            <Link href={storeHref("/#catalogo")}>Produtos</Link>
            <Link href={storeHref("/#beneficios")}>Beneficios</Link>
            <Link href={storeHref("/#duvidas")}>Dúvidas</Link>
            {navigationPages.map((page) => <Link href={storeHref(`/paginas/${page.slug}`)} key={page.id}>{page.name}</Link>)}
          </nav>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="Buscar produtos"
              aria-expanded={searchOpen}
            >
              {searchOpen ? <X /> : <Search />}
            </button>
            <button
              className="cart-button"
              onClick={() => setDrawerOpen(true)}
              aria-label={`Abrir carrinho com ${itemCount} itens`}
            >
              <ShoppingCart />
              <span>Carrinho</span>
              <b>{itemCount}</b>
            </button>
            <button
              className="mobile-menu"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
            >
              <Menu />
            </button>
          </div>
        </div>
        {searchOpen && (
          <form className="search-bar" onSubmit={submitSearch}>
            <div className="container search-inner">
              <Search aria-hidden="true" />
              <label className="sr-only" htmlFor="global-search">
                Buscar produtos
              </label>
              <input
                id="global-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Busque por produto, categoria ou marca"
                autoFocus
              />
              <button type="submit">Buscar</button>
            </div>
          </form>
        )}
        {menuOpen && (
          <nav className="mobile-nav" aria-label="Navegacao movel">
            <Link href={storeHref("/#destaques")} onClick={() => setMenuOpen(false)}>Destaques</Link>
            <Link href={storeHref("/#catalogo")} onClick={() => setMenuOpen(false)}>Produtos</Link>
            <Link href={storeHref("/#beneficios")} onClick={() => setMenuOpen(false)}>Beneficios</Link>
            <Link href={storeHref("/#duvidas")} onClick={() => setMenuOpen(false)}>Dúvidas</Link>
            {navigationPages.map((page) => <Link href={storeHref(`/paginas/${page.slug}`)} key={page.id} onClick={() => setMenuOpen(false)}>{page.name}</Link>)}
          </nav>
        )}
      </header>
    </>
  );
}
