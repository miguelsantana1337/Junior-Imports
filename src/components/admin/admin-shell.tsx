"use client";

import {
  IconBell,
  IconArrowRight,
  IconBox,
  IconChevronDown,
  IconChevronLeft,
  IconCloudCheck,
  IconDatabase,
  IconDots,
  IconExternalLink,
  IconHome,
  IconLayoutDashboard,
  IconLogout,
  IconMenu2,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconSettings,
  IconTag,
  IconTicket,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/auth-actions";

const navigationGroups = [
  {
    label: "Operação",
    items: [
      { href: "/admin", label: "Visão geral", icon: IconHome },
      { href: "/admin/orders", label: "Pedidos", icon: IconReceipt2 },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/products", label: "Produtos", icon: IconPackage },
      { href: "/admin/categories", label: "Categorias", icon: IconTag },
    ],
  },
  {
    label: "Loja",
    items: [
      { href: "/admin/sections", label: "Página inicial", icon: IconLayoutDashboard },
      { href: "/admin/banners", label: "Banners", icon: IconPhoto },
    ],
  },
  {
    label: "Marketing",
    items: [{ href: "/admin/coupons", label: "Cupons", icon: IconTicket }],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/settings", label: "Configurações", icon: IconSettings },
      { href: "/admin/data", label: "Dados", icon: IconDatabase },
    ],
  },
];

const navigation = navigationGroups.flatMap((group) => group.items);

const titles: Record<string, [string, string]> = {
  "/admin": ["PAINEL", "Visão geral"],
  "/admin/products": ["CATÁLOGO", "Produtos"],
  "/admin/banners": ["LOJA VIRTUAL", "Banners rotativos"],
  "/admin/categories": ["CATÁLOGO", "Categorias"],
  "/admin/sections": ["LOJA VIRTUAL", "Página inicial"],
  "/admin/coupons": ["MARKETING", "Cupons"],
  "/admin/orders": ["OPERAÇÃO", "Pedidos demonstrativos"],
  "/admin/settings": ["SISTEMA", "Configurações"],
  "/admin/data": ["SISTEMA", "Dados e backup"],
};

const createLinks = [
  { href: "/admin/products?novo=1", label: "Novo produto", icon: IconPackage },
  { href: "/admin/coupons?novo=1", label: "Novo cupom", icon: IconTicket },
  { href: "/admin/banners?novo=1", label: "Novo banner", icon: IconPhoto },
];

export function AdminShell({ children, email, demoMode }: { children: ReactNode; email: string; demoMode: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [eyebrow, title] = titles[pathname] ?? titles["/admin"];
  const accountName = useMemo(() => {
    const localPart = email.split("@")[0] ?? "Administrador";
    if (localPart.toLowerCase().startsWith("miguel")) return "Miguel Santana";
    return localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }, [email]);
  const searchDestination = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return pathname;
    const match = navigation.find((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalized));
    return match?.href ?? `/admin/products?busca=${encodeURIComponent(query.trim())}`;
  }, [pathname, query]);

  useEffect(() => {
    setOpen(false);
    setCreateOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setCreateOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", closeMenus);
    return () => window.removeEventListener("keydown", closeMenus);
  }, []);

  return (
    <div className={`admin-shell-next ${collapsed ? "is-collapsed" : ""}`}>
      <aside className={`admin-sidebar-next ${open ? "open" : ""}`}>
        <div className="admin-icon-rail" aria-label="Navegação rápida">
          <Link className="admin-rail-brand" href="/admin" aria-label="Junior Imports - painel">
            <Image src="/admin-brand.png" width={38} height={38} alt="" priority />
          </Link>
          <div className="admin-rail-links">
            {navigation.map(({ href, label, icon: Icon }) => (
              <Link className={pathname === href ? "active" : ""} href={href} key={href} aria-label={label} title={label}>
                <Icon stroke={1.8} />
              </Link>
            ))}
          </div>
          <div className="admin-rail-bottom">
            <Link href="/admin/products?novo=1" aria-label="Criar produto" title="Criar produto"><IconPlus stroke={1.8} /></Link>
            <Link href="/" target="_blank" aria-label="Ver loja" title="Ver loja"><IconExternalLink stroke={1.8} /></Link>
            <Link href="/admin/data" aria-label="Mais opções" title="Mais opções"><IconDots stroke={1.8} /></Link>
            <form action={logoutAction}><button aria-label="Sair" title="Sair"><IconLogout stroke={1.8} /></button></form>
          </div>
        </div>

        <div className="admin-sidebar-panel">
          <div className="admin-brand">
            <div><strong>Junior Imports</strong><small>Painel de controle</small></div>
            <button className="admin-collapse-button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}><IconChevronLeft /></button>
            <button className="admin-mobile-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><IconX /></button>
          </div>

          <nav className="admin-nav-groups" aria-label="Navegação administrativa">
            {navigationGroups.map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link className={pathname === href ? "active" : ""} href={href} key={href}>
                    <Icon stroke={1.8} />{label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-status">
            <div className="admin-connection-card">
              <span className="admin-live-dot" />
              <div><strong>{demoMode ? "Modo local ativo" : "Supabase conectado"}</strong><small>{demoMode ? "Dados neste navegador" : "juniorimports"}</small></div>
              <IconCloudCheck />
              <Link href="/admin/data"><IconDatabase /> Ver conexão</Link>
            </div>
            <div className="admin-demo-card">
              <IconBox />
              <div><strong>Demonstração</strong><small>Não realiza vendas reais</small></div>
            </div>
          </div>
        </div>
      </aside>

      {open && <button className="admin-sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Fechar navegação" />}

      <section className="admin-main-next">
        <header className="admin-topbar-next">
          <button className="admin-menu-toggle" onClick={() => setOpen(true)} aria-label="Abrir menu"><IconMenu2 /></button>
          <div className="admin-global-search" role="search">
            <IconSearch />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) window.location.assign(searchDestination); }} aria-label="Buscar no painel" placeholder="Buscar produtos, pedidos ou configurações" />
            <Link className="admin-search-submit" href={searchDestination} onClick={() => setQuery("")} aria-label="Buscar"><IconArrowRight /></Link>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-popover-wrap">
              <button className="admin-create-button" onClick={() => setCreateOpen((current) => !current)} aria-expanded={createOpen}>
                <IconPlus /> Criar <span /><IconChevronDown />
              </button>
              {createOpen && <div className="admin-popover admin-create-menu">{createLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={label}><Icon />{label}</Link>)}</div>}
            </div>
            <div className="admin-popover-wrap">
              <button className="admin-notification-button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notificações" aria-expanded={notificationsOpen}>
                <IconBell /><span>3</span>
              </button>
              {notificationsOpen && <div className="admin-popover admin-notifications"><strong>Notificações</strong><p>2 produtos estão com estoque baixo.</p><p>O painel está conectado ao Supabase.</p><Link href="/admin/orders">Ver pedidos de teste</Link></div>}
            </div>
            <Link className="admin-view-store" href="/" target="_blank">Ver loja <IconExternalLink /></Link>
            <div className="admin-account">
              <span>{accountName.slice(0, 1)}</span>
              <div><strong>{accountName}</strong><small>{email}</small></div>
              <IconChevronDown />
            </div>
          </div>
        </header>

        <div className="admin-content-next">
          {pathname !== "/admin" && <div className="admin-page-heading"><div><span>{eyebrow}</span><h1>{title}</h1></div><small><IconCloudCheck /> {demoMode ? "Modo demonstrativo" : "Supabase conectado"}</small></div>}
          {children}
        </div>
      </section>
    </div>
  );
}
