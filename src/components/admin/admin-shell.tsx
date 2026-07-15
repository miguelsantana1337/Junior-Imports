"use client";

import {
  IconBell,
  IconArrowRight,
  IconBox,
  IconChevronDown,
  IconChevronLeft,
  IconCloudCheck,
  IconDatabase,
  IconExternalLink,
  IconFileSpreadsheet,
  IconHome,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLogout,
  IconMenu2,
  IconMessageCircle,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconSettings,
  IconTag,
  IconTicket,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/auth-actions";
import { adminRoleLabels, hasAdminPermission } from "@/lib/admin-permissions";
import type { AdminPermission, AdminRole } from "@/types/store";
import { useStore } from "@/components/providers/store-provider";
import { platformConfig } from "@/config/platform";

const navigationGroups = [
  {
    label: "Operação",
    items: [
      { href: "/admin", label: "Visão geral", icon: IconHome, permission: "dashboard" },
      { href: "/admin/customers", label: "Clientes", icon: IconUsers, permission: "customers" },
      { href: "/admin/orders", label: "Pedidos", icon: IconReceipt2, permission: "orders" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/products", label: "Produtos", icon: IconPackage, permission: "catalog" },
      { href: "/admin/categories", label: "Categorias", icon: IconTag, permission: "catalog" },
      { href: "/admin/import", label: "Importar planilha", icon: IconFileSpreadsheet, permission: "catalog" },
    ],
  },
  {
    label: "Loja",
    items: [
      { href: "/admin/layout", label: "Editor da loja", icon: IconLayoutGrid, permission: "store" },
      { href: "/admin/sections", label: "Conteúdo da home", icon: IconLayoutDashboard, permission: "store" },
      { href: "/admin/banners", label: "Banners", icon: IconPhoto, permission: "store" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/admin/coupons", label: "Cupons", icon: IconTicket, permission: "marketing" },
      { href: "/admin/messages", label: "Mensagens", icon: IconMessageCircle, permission: "marketing" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/admin/users", label: "Usuários", icon: IconUsers, permission: "users" },
      { href: "/admin/settings", label: "Configurações", icon: IconSettings, permission: "settings" },
      { href: "/admin/data", label: "Dados", icon: IconDatabase, permission: "data" },
    ],
  },
];

const navigation = navigationGroups.flatMap((group) => group.items);

const titles: Record<string, [string, string]> = {
  "/admin": ["PAINEL", "Visão geral"],
  "/admin/products": ["CATÁLOGO", "Produtos"],
  "/admin/banners": ["LOJA VIRTUAL", "Banners rotativos"],
  "/admin/categories": ["CATÁLOGO", "Categorias"],
  "/admin/import": ["CATÁLOGO", "Importação em massa"],
  "/admin/sections": ["LOJA VIRTUAL", "Página inicial"],
  "/admin/layout": ["LOJA VIRTUAL", "Editor de layout"],
  "/admin/coupons": ["MARKETING", "Cupons"],
  "/admin/messages": ["MARKETING", "Mensagens automáticas"],
  "/admin/orders": ["OPERAÇÃO", "Pedidos demonstrativos"],
  "/admin/customers": ["CRM", "Clientes e relacionamento"],
  "/admin/settings": ["SISTEMA", "Configurações"],
  "/admin/users": ["SISTEMA", "Usuários e permissões"],
  "/admin/data": ["SISTEMA", "Dados e backup"],
};

const createLinks = [
  { href: "/admin/products/new", label: "Novo produto", icon: IconPackage, permission: "catalog" },
  { href: "/admin/import", label: "Importar planilha", icon: IconFileSpreadsheet, permission: "catalog" },
  { href: "/admin/coupons?novo=1", label: "Novo cupom", icon: IconTicket, permission: "marketing" },
  { href: "/admin/banners?novo=1", label: "Novo banner", icon: IconPhoto, permission: "store" },
  { href: "/admin/layout?novo=pagina", label: "Nova página", icon: IconLayoutGrid, permission: "store" },
  { href: "/admin/messages?novo=1", label: "Nova automação", icon: IconMessageCircle, permission: "marketing" },
  { href: "/admin/users?novo=1", label: "Novo usuário", icon: IconUsers, permission: "users" },
];

type ShellUser = { id: string; fullName: string; email: string; role: AdminRole; permissions: AdminPermission[]; isPlatformAdmin: boolean };

export function AdminShell({ children, user, demoMode }: { children: ReactNode; user: ShellUser; demoMode: boolean }) {
  const { data } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [eyebrow, title] = titles[pathname] ?? titles["/admin"];
  const productEditorPath = pathname === "/admin/products/new" || pathname.startsWith("/admin/products/");
  const isNavigationActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
  const accountName = user.fullName || user.email.split("@")[0] || "Administrador";
  const can = (permission: string) => hasAdminPermission(user.role, user.permissions, permission as AdminPermission);
  const visibleNavigation = navigation.filter((item) => can(item.permission));
  const visibleCreateLinks = createLinks.filter((item) => can(item.permission));
  const lowStockCount = data.products.filter((product) => product.active && product.stock <= 10).length;
  const pendingOrderCount = data.orders.filter((order) => ["Novo", "Aguardando pagamento", "Pago", "Preparando"].includes(order.status)).length;
  const notificationCount = Number(lowStockCount > 0) + Number(pendingOrderCount > 0);
  const searchDestination = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (!normalized) return pathname;
    const match = visibleNavigation.find((item) => item.label.toLocaleLowerCase("pt-BR").includes(normalized));
    return match?.href ?? pathname;
  }, [pathname, query, visibleNavigation]);

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
        <div className="admin-sidebar-panel">
          <div className="admin-brand">
            <Link className="admin-brand-mark" href="/admin" aria-label={`${data.settings.storeName} - painel`}>
              <Image src={data.settings.logoUrl || platformConfig.defaultLogoUrl} fill sizes="38px" alt="" priority unoptimized />
            </Link>
            <div className="admin-brand-copy"><strong>{data.settings.storeName}</strong><small>Painel de controle</small></div>
            <button className="admin-collapse-button" onClick={() => setCollapsed((current) => !current)} aria-label={collapsed ? "Expandir menu" : "Recolher menu"}><IconChevronLeft /></button>
            <button className="admin-mobile-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><IconX /></button>
          </div>

          <nav className="admin-nav-groups" aria-label="Navegação administrativa">
            {navigationGroups.map((group) => ({ ...group, items: group.items.filter((item) => can(item.permission)) })).filter((group) => group.items.length).map((group) => (
              <div className="admin-nav-group" key={group.label}>
                <span>{group.label}</span>
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link className={isNavigationActive(href) ? "active" : ""} href={href} key={href} title={collapsed ? label : undefined}>
                    <Icon stroke={1.8} /><span>{label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="admin-sidebar-status">
            <div className="admin-connection-card">
              <span className="admin-live-dot" />
              <div><strong>{demoMode ? "Modo local ativo" : "Supabase conectado"}</strong><small>{demoMode ? "Dados neste navegador" : platformConfig.clientId}</small></div>
              <IconCloudCheck />
              <Link href="/admin/data"><IconDatabase /> Ver conexão</Link>
            </div>
            <div className="admin-demo-card">
              <IconBox />
              <div><strong>Demonstração</strong><small>Não realiza vendas reais</small></div>
            </div>
          </div>

          <div className="admin-sidebar-actions">
            <Link href={data.tenant.storefrontPath || "/"} target="_blank" title="Ver loja"><IconExternalLink /><span>Ver loja</span></Link>
            <form action={logoutAction}><button title="Sair"><IconLogout /><span>Sair</span></button></form>
          </div>
        </div>
      </aside>

      {open && <button className="admin-sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Fechar navegação" />}

      <section className="admin-main-next">
        <header className="admin-topbar-next">
          <button className="admin-menu-toggle" onClick={() => setOpen(true)} aria-label="Abrir menu"><IconMenu2 /></button>
          <div className="admin-global-search" role="search">
            <IconSearch />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && query.trim()) window.location.assign(searchDestination); }} aria-label="Ir para uma área do painel" placeholder="Ir para produtos, pedidos ou configurações" />
            <Link className="admin-search-submit" href={searchDestination} onClick={() => setQuery("")} aria-label="Buscar"><IconArrowRight /></Link>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-popover-wrap">
              <button className="admin-create-button" onClick={() => setCreateOpen((current) => !current)} aria-expanded={createOpen}>
                <IconPlus /> Criar <span /><IconChevronDown />
              </button>
              {createOpen && <div className="admin-popover admin-create-menu">{visibleCreateLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={label}><Icon />{label}</Link>)}</div>}
            </div>
            <div className="admin-popover-wrap">
              <button className="admin-notification-button" onClick={() => setNotificationsOpen((current) => !current)} aria-label="Notificações" aria-expanded={notificationsOpen}>
                <IconBell />{notificationCount > 0 && <span>{notificationCount}</span>}
              </button>
              {notificationsOpen && <div className="admin-popover admin-notifications"><strong>Notificações</strong>{lowStockCount > 0 && <p>{lowStockCount} produto{lowStockCount === 1 ? "" : "s"} com estoque baixo.</p>}{pendingOrderCount > 0 && <p>{pendingOrderCount} pedido{pendingOrderCount === 1 ? "" : "s"} aguardando acompanhamento.</p>}{notificationCount === 0 && <p>Nenhuma pendência no momento.</p>}<Link href={pendingOrderCount ? "/admin/orders" : "/admin/products"}>Revisar painel</Link></div>}
            </div>
            <Link className="admin-view-store" href={data.tenant.storefrontPath || "/"} target="_blank">Ver loja <IconExternalLink /></Link>
            <div className="admin-account">
              <span>{accountName.slice(0, 1)}</span>
              <div><strong>{accountName}</strong><small>{adminRoleLabels[user.role]} · {user.email}</small></div>
            </div>
          </div>
        </header>

        <div className="admin-content-next">
          {pathname !== "/admin" && !productEditorPath && <div className="admin-page-heading"><div><span>{eyebrow}</span><h1>{title}</h1></div><small><IconCloudCheck /> {demoMode ? "Modo demonstrativo" : "Supabase conectado"}</small></div>}
          {children}
        </div>
      </section>
    </div>
  );
}
