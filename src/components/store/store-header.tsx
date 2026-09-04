"use client";

import { Home, Menu, MessageCircle, Search, ShoppingCart, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { Logo } from "@/components/ui/logo";
import { resolveStoreAnnouncement } from "@/lib/store-announcement";
import { withStorefrontPath } from "@/lib/storefront-path";
import { electronicsHomeHref, resolveElectronicsHome } from "@/lib/electronics-home";
import { whatsappUrl } from "@/lib/format";

export function StoreHeader() {
  const { data, storefrontScope } = useStore();
  const { itemCount, setDrawerOpen } = useCart();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const navigationPages = data.pages.filter((page) => page.active && page.showInNavigation && !page.isHome).sort((a, b) => a.order - b.order);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const isElectronicsStore = storefrontScope === "electronics";
  const electronicsAnnouncement = resolveElectronicsHome(data.tenant.id, data.pageBlocks).announcement;
  const electronicsHref = isElectronicsStore ? storeHref("/") : storeHref("/eletronicos");
  const showElectronicsPortal = storefrontScope === "all"
    && data.categories.some((category) => category.active && category.slug === "eletronicos");
  const announcement = isElectronicsStore
    ? electronicsAnnouncement.title
    : resolveStoreAnnouncement(data.settings);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    if (isElectronicsStore) setSearchOpen(false);
    if (pathname === (data.tenant.storefrontPath || "/") || (storefrontScope === "all" && pathname === electronicsHref)) {
      window.dispatchEvent(new CustomEvent("junior-search", { detail: query }));
      document.querySelector("#catalogo")?.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`${storeHref("/")}?q=${encodeURIComponent(query)}#catalogo`);
    }
  }

  return (
    <>
      <div className={`announcement ${isElectronicsStore ? "electronics-announcement" : ""}`}>
        <div className="container announcement-inner">
          <span>{announcement}</span>
          <Link href={storeHref(isElectronicsStore ? electronicsHomeHref(electronicsAnnouncement.buttonLink) : "/#catalogo")}>{isElectronicsStore ? electronicsAnnouncement.buttonText : "Ver ofertas"} →</Link>
        </div>
      </div>
      <header className={`store-header ${isElectronicsStore ? "electronics-header" : ""}`}>
        <div className="container header-inner">
          <Logo />
          <nav className="desktop-nav" aria-label="Navegacao principal">
            {isElectronicsStore ? <>
              <Link href={storeHref("/")} aria-current={pathname === storeHref("/") ? "page" : undefined}>Início</Link>
              <Link href={storeHref("/#catalogo")}>Eletrônicos</Link>
              <Link href={storeHref("/#como-comprar")}>Como comprar</Link>
              <Link href={storeHref("/#duvidas")}>Dúvidas</Link>
            </> : <>
              <Link href={storeHref("/#destaques")}>Destaques</Link>
              <Link href={storeHref("/#catalogo")}>Produtos</Link>
              {showElectronicsPortal && <Link href={electronicsHref}>Eletrônicos</Link>}
              <Link href={storeHref("/#beneficios")}>Beneficios</Link>
              <Link href={storeHref("/#duvidas")}>Como comprar</Link>
              {navigationPages.map((page) => <Link href={storeHref(`/paginas/${page.slug}`)} key={page.id}>{page.name}</Link>)}
            </>}
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
                placeholder={isElectronicsStore ? "Busque por eletrônico, modelo ou marca" : "Busque por produto, categoria ou marca"}
                autoFocus
              />
              <button type="submit">Buscar</button>
            </div>
          </form>
        )}
        {menuOpen && (
          <nav className="mobile-nav" aria-label="Navegacao movel">
            {isElectronicsStore ? <>
              <Link href={storeHref("/")} aria-current={pathname === storeHref("/") ? "page" : undefined} onClick={() => setMenuOpen(false)}>Início</Link>
              <Link href={storeHref("/#catalogo")} onClick={() => setMenuOpen(false)}>Eletrônicos</Link>
              <Link href={storeHref("/#como-comprar")} onClick={() => setMenuOpen(false)}>Como comprar</Link>
              <Link href={storeHref("/#duvidas")} onClick={() => setMenuOpen(false)}>Dúvidas</Link>
            </> : <>
              <Link href={storeHref("/#destaques")} onClick={() => setMenuOpen(false)}>Destaques</Link>
              <Link href={storeHref("/#catalogo")} onClick={() => setMenuOpen(false)}>Produtos</Link>
              {showElectronicsPortal && <Link href={electronicsHref} onClick={() => setMenuOpen(false)}>Eletrônicos</Link>}
              <Link href={storeHref("/#beneficios")} onClick={() => setMenuOpen(false)}>Beneficios</Link>
              <Link href={storeHref("/#duvidas")} onClick={() => setMenuOpen(false)}>Como comprar</Link>
              {navigationPages.map((page) => <Link href={storeHref(`/paginas/${page.slug}`)} key={page.id} onClick={() => setMenuOpen(false)}>{page.name}</Link>)}
            </>}
          </nav>
        )}
      </header>
      {isElectronicsStore && <nav className="electronics-mobile-nav" aria-label="Atalhos da loja">
        <Link href={storeHref("/")} aria-current={pathname === storeHref("/") ? "page" : undefined}><Home /><span>Início</span></Link>
        <button type="button" aria-expanded={searchOpen} onClick={() => { setSearchOpen(true); setMenuOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Search /><span>Buscar</span></button>
        <button type="button" onClick={() => setDrawerOpen(true)}><ShoppingCart /><span>Carrinho</span><b>{itemCount}</b></button>
        <a href={whatsappUrl(data.settings.whatsapp, `Olá! Vim pela loja de eletrônicos da ${data.settings.storeName} e gostaria de atendimento.`)} target="_blank" rel="noreferrer"><MessageCircle /><span>Atendimento</span></a>
      </nav>}
    </>
  );
}
