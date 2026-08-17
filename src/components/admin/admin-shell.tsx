"use client";

import {
  IconBox,
  IconChevronDown,
  IconChevronLeft,
  IconChartBar,
  IconCloudCheck,
  IconDatabase,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFileSpreadsheet,
  IconHome,
  IconLayoutGrid,
  IconLogout,
  IconMenu2,
  IconMessageCircle,
  IconMoon,
  IconPackage,
  IconPhoto,
  IconPlus,
  IconReceipt2,
  IconSearch,
  IconSettings,
  IconShieldLock,
  IconBrandOpenai,
  IconSun,
  IconTag,
  IconTicket,
  IconShoppingCartOff,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/auth-actions";
import { adminRoleLabels, hasAdminPermission } from "@/lib/admin-permissions";
import type { AdminPermission, AdminRole } from "@/types/store";
import { useAdminData } from "@/components/admin/admin-data-provider";
import { platformConfig } from "@/config/platform";
import { clearAdminSensitiveBrowserStorage } from "@/lib/browser-storage";
import { AdminPwaInstall } from "@/components/admin/admin-pwa-install";
import { AdminLoadingScreen } from "@/components/admin/admin-loading-screen";
import { AdminCommandPalette, type AdminCommandSource } from "@/components/admin/admin-command-palette";
import { useAdminPreferences } from "@/components/admin/use-admin-preferences";
import { CopilotJunior } from "@/components/admin/copilot-junior";
import { AdminNotificationCenter } from "@/components/admin/admin-notification-center";
import { AdminPeriodProvider, AdminPeriodSelector } from "@/components/admin/admin-period-context";

const navigationGroups = [
  {
    id: "today",
    label: "Hoje",
    items: [
      { href: "/admin", label: "Prioridades do dia", icon: IconHome, permission: "dashboard" },
      { href: "/admin/operations", label: "Central operacional", icon: IconCloudCheck, permission: "dashboard" },
    ],
  },
  {
    id: "operation",
    label: "Operação",
    items: [
      { href: "/admin/orders", label: "Pedidos", icon: IconReceipt2, permission: "orders" },
      { href: "/admin/abandoned-carts", label: "Carrinhos abandonados", icon: IconShoppingCartOff, permission: "orders" },
      { href: "/admin/customers", label: "Clientes", icon: IconUsers, permission: "customers" },
      { href: "/admin/crm", label: "Tarefas e contatos", icon: IconMessageCircle, permission: "crm" },
    ],
  },
  {
    id: "management",
    label: "Gestão",
    items: [
      { href: "/admin/finance", label: "Caixa e resultados", icon: IconReceipt2, permission: "finance" },
      { href: "/admin/inventory", label: "Estoque e lotes", icon: IconBox, permission: "inventory" },
      { href: "/admin/reports", label: "Relatórios e exportações", icon: IconChartBar, permission: "reports" },
    ],
  },
  {
    id: "store",
    label: "Loja",
    items: [
      { href: "/admin/layout", label: "Editor da loja", icon: IconLayoutGrid, permission: "store" },
      { href: "/admin/products", label: "Produtos", icon: IconPackage, permission: "catalog" },
      { href: "/admin/categories", label: "Categorias", icon: IconTag, permission: "catalog" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    items: [
      { href: "/admin/coupons", label: "Cupons", icon: IconTicket, permission: "marketing" },
      { href: "/admin/referrals", label: "Programa de indicações", icon: IconUsers, permission: "customers" },
      { href: "/admin/messages", label: "Campanhas e automações", icon: IconMessageCircle, permission: "marketing" },
    ],
  },
  {
    id: "administration",
    label: "Administração",
    items: [
      { href: "/admin/users", label: "Acessos e permissões", icon: IconUsers, permission: "users" },
      { href: "/admin/security", label: "Segurança e MFA", icon: IconShieldLock, permission: null },
      { href: "/admin/integrations/chatgpt", label: "ChatGPT", icon: IconBrandOpenai, permission: "settings" },
      { href: "/admin/settings", label: "Loja, frete e atendimento", icon: IconSettings, permission: "settings" },
      { href: "/admin/data", label: "Backup e auditoria", icon: IconDatabase, permission: "data" },
    ],
  },
];

const navigation = navigationGroups.flatMap((group) => group.items);

const utilityNavigation = [
  { href: "/admin/banners", label: "Biblioteca de banners", icon: IconPhoto, permission: "store" },
  { href: "/admin/import", label: "Importar planilha", icon: IconFileSpreadsheet, permission: "catalog" },
];

const titles: Record<string, [string, string]> = {
  "/admin": ["HOJE", "Prioridades do dia"],
  "/admin/operations": ["ADMIN 3.1", "Central operacional"],
  "/admin/products": ["CATÁLOGO", "Produtos"],
  "/admin/banners": ["EDITOR DA LOJA", "Biblioteca de banners"],
  "/admin/categories": ["CATÁLOGO", "Categorias"],
  "/admin/import": ["PRODUTOS", "Importação por planilha"],
  "/admin/layout": ["LOJA VIRTUAL", "Editor da loja"],
  "/admin/coupons": ["MARKETING", "Cupons"],
  "/admin/referrals": ["MARKETING", "Programa de indicações"],
  "/admin/messages": ["MARKETING", "Campanhas e automações"],
  "/admin/orders": ["OPERAÇÃO", "Pedidos"],
  "/admin/abandoned-carts": ["OPERAÇÃO", "Carrinhos abandonados"],
  "/admin/crm": ["RELACIONAMENTO", "Tarefas e contatos"],
  "/admin/customers": ["RELACIONAMENTO", "Clientes"],
  "/admin/finance": ["GESTÃO", "Caixa e resultados"],
  "/admin/inventory": ["ERP", "Estoque e lotes"],
  "/admin/reports": ["GESTÃO", "Relatórios e exportações"],
  "/admin/settings": ["ADMINISTRAÇÃO", "Loja, frete e atendimento"],
  "/admin/users": ["ADMINISTRAÇÃO", "Acessos e permissões"],
  "/admin/security": ["ADMINISTRAÇÃO", "Segurança e MFA"],
  "/admin/integrations/chatgpt": ["INTEGRAÇÕES", "ChatGPT"],
  "/admin/data": ["ADMINISTRAÇÃO", "Backup e auditoria"],
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
type AdminTheme = "light" | "dark";

const adminThemeStorageKey = "junior-imports:admin-theme";
const adminSidebarStorageKey = "junior-imports:admin-sidebar";
const adminMoneyVisibilityStorageKey = "junior-imports:admin-money-hidden";

export function AdminShell({ children, user, demoMode }: { children: ReactNode; user: ShellUser; demoMode: boolean }) {
  const { data, referenceNow } = useAdminData();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [theme, setTheme] = useState<AdminTheme>("light");
  const [moneyHidden, setMoneyHidden] = useState(false);
  const [navigationPending, setNavigationPending] = useState(false);
  const activeNavigationGroupId = navigationGroups.find((group) => group.items.some((item) => pathname === item.href || (item.href !== "/admin" && pathname.startsWith(`${item.href}/`))))?.id
    ?? (pathname.startsWith("/admin/banners") || pathname.startsWith("/admin/import") ? "store" : "operation");
  const [expandedNavigationGroup, setExpandedNavigationGroup] = useState(activeNavigationGroupId);
  const createPopoverRef = useRef<HTMLDivElement>(null);
  const notificationsPopoverRef = useRef<HTMLDivElement>(null);
  const { preferences, updatePreferences } = useAdminPreferences(user.id);
  const [eyebrow, title] = titles[pathname] ?? titles["/admin"];
  const productEditorPath = pathname === "/admin/products/new" || pathname.startsWith("/admin/products/");
  const isNavigationActive = (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`));
  const accountName = user.fullName || user.email.split("@")[0] || "Administrador";
  const can = (permission: string) => hasAdminPermission(user.role, user.permissions, permission as AdminPermission);
  const visibleNavigation = navigation.filter((item) => item.permission === null || can(item.permission));
  const visibleUtilityNavigation = utilityNavigation.filter((item) => can(item.permission));
  const visibleCreateLinks = createLinks.filter((item) => can(item.permission));
  const firstFlowRecordAt = [...data.orders, ...data.financialTransactions]
    .map((item) => item.createdAt)
    .filter((value) => Number.isFinite(new Date(value).getTime()))
    .sort()[0];
  const commandSources: AdminCommandSource[] = [
    ...visibleNavigation.map((item) => ({ ...item, group: "Navegação" as const })),
    ...visibleUtilityNavigation.map((item) => ({ ...item, group: "Navegação" as const })),
    ...visibleCreateLinks.map((item) => ({ ...item, group: "Criar" as const })),
  ];

  useEffect(() => {
    setOpen(false);
    setCreateOpen(false);
    setNotificationsOpen(false);
    setCommandOpen(false);
    setNavigationPending(false);
  }, [pathname]);

  useEffect(() => {
    const closeMenus = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        setCreateOpen(false);
        setNotificationsOpen(false);
        setCommandOpen(false);
      }
    };
    window.addEventListener("keydown", closeMenus);
    return () => window.removeEventListener("keydown", closeMenus);
  }, []);

  useEffect(() => {
    if (!createOpen && !notificationsOpen) return;

    const closeOnOutsideInteraction = (event: PointerEvent) => {
      const target = event.target as Node;
      if (createOpen && !createPopoverRef.current?.contains(target)) setCreateOpen(false);
      if (notificationsOpen && !notificationsPopoverRef.current?.contains(target)) setNotificationsOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsideInteraction);
    return () => document.removeEventListener("pointerdown", closeOnOutsideInteraction);
  }, [createOpen, notificationsOpen]);

  useLayoutEffect(() => {
    const savedTheme = window.localStorage.getItem(adminThemeStorageKey);
    const preferredTheme: AdminTheme = savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";

    setTheme(preferredTheme);
    document.documentElement.dataset.adminTheme = preferredTheme;
    setCollapsed(window.localStorage.getItem(adminSidebarStorageKey) === "collapsed");
    setMoneyHidden(window.localStorage.getItem(adminMoneyVisibilityStorageKey) === "true");
  }, [activeNavigationGroupId]);

  useEffect(() => {
    setExpandedNavigationGroup(activeNavigationGroupId);
  }, [activeNavigationGroupId]);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme: AdminTheme = currentTheme === "dark" ? "light" : "dark";
      window.localStorage.setItem(adminThemeStorageKey, nextTheme);
      document.documentElement.dataset.adminTheme = nextTheme;
      return nextTheme;
    });
  };

  const toggleSidebar = () => {
    setCollapsed((currentState) => {
      const nextState = !currentState;
      window.localStorage.setItem(adminSidebarStorageKey, nextState ? "collapsed" : "expanded");
      return nextState;
    });
  };

  const toggleMoneyVisibility = () => {
    setMoneyHidden((currentState) => {
      const nextState = !currentState;
      window.localStorage.setItem(adminMoneyVisibilityStorageKey, String(nextState));
      return nextState;
    });
  };

  const toggleNavigationGroup = (groupId: string) => {
    setExpandedNavigationGroup((current) => current === groupId ? "" : groupId);
  };

  return (
    <AdminPeriodProvider
      preset={preferences.globalPeriod}
      referenceNow={referenceNow}
      operationStartedAt={data.settings.operationStartedAt}
      fallbackStartedAt={firstFlowRecordAt}
      onChange={(globalPeriod) => updatePreferences((current) => ({ ...current, globalPeriod }))}
    >
    <div
      className={`admin-shell-next admin-minimal-preview ${collapsed ? "is-collapsed" : ""} ${moneyHidden ? "admin-money-hidden" : ""}`}
      onClickCapture={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = (event.target as HTMLElement).closest<HTMLAnchorElement>("a[href]");
        if (!anchor || anchor.target === "_blank") return;
        const destination = new URL(anchor.href, window.location.href);
        if (destination.origin === window.location.origin && destination.pathname.startsWith("/admin") && `${destination.pathname}${destination.search}` !== `${window.location.pathname}${window.location.search}`) {
          setNavigationPending(true);
        }
      }}
    >
      <AdminLoadingScreen autoDismiss />
      {can("copilot") && <CopilotJunior />}
      <AdminCommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        data={data}
        sources={commandSources}
        favoriteHrefs={preferences.favoriteHrefs}
        onToggleFavorite={(href) => updatePreferences((current) => ({
          ...current,
          favoriteHrefs: current.favoriteHrefs.includes(href)
            ? current.favoriteHrefs.filter((item) => item !== href)
            : [...current.favoriteHrefs, href],
        }))}
      />
      <div className={`admin-navigation-progress ${navigationPending ? "is-active" : ""}`} aria-hidden="true"><span /></div>
      <aside className={`admin-sidebar-next ${open ? "open" : ""}`}>
        <div className="admin-sidebar-panel">
          <div className="admin-brand">
            <Link className="admin-brand-mark" href="/admin" aria-label={`${data.settings.storeName} - painel`}>
              <Image src={data.settings.logoUrl || platformConfig.defaultLogoUrl} fill sizes="38px" alt="" priority unoptimized />
            </Link>
            <div className="admin-brand-copy"><strong>{data.settings.storeName}</strong><small>Painel de controle</small></div>
            <button className="admin-mobile-close" onClick={() => setOpen(false)} aria-label="Fechar menu"><IconX /></button>
          </div>

          <div className="admin-mobile-drawer-tools" aria-label="Ações rápidas">
            <button type="button" onClick={() => { setOpen(false); setCommandOpen(true); }}><IconSearch /><span>Buscar</span></button>
            <AdminPeriodSelector variant="drawer" />
            <button type="button" onClick={toggleTheme}>{theme === "dark" ? <IconSun /> : <IconMoon />}<span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span></button>
            <Link href={data.tenant.storefrontPath || "/"} target="_blank"><IconExternalLink /><span>Ver loja</span></Link>
          </div>

          <nav className="admin-nav-groups" aria-label="Navegação administrativa">
            {navigationGroups.map((group) => ({ ...group, items: group.items.filter((item) => item.permission === null || can(item.permission)) })).filter((group) => group.items.length).map((group) => {
              const expanded = collapsed || expandedNavigationGroup === group.id;
              return <div className={`admin-nav-group ${expanded ? "is-expanded" : ""}`} key={group.id}>
                <button className="admin-nav-group-toggle" type="button" onClick={() => toggleNavigationGroup(group.id)} aria-expanded={expanded} aria-controls={`admin-nav-${group.id}`}>
                  <span>{group.label}</span><IconChevronDown aria-hidden="true" />
                </button>
                <div className="admin-nav-group-items" id={`admin-nav-${group.id}`} hidden={!expanded}>
                  {group.items.map(({ href, label, icon: Icon }) => (
                    <Link className={isNavigationActive(href) || (href === "/admin/layout" && pathname.startsWith("/admin/banners")) || (href === "/admin/products" && pathname.startsWith("/admin/import")) ? "active" : ""} href={href} key={href} title={collapsed ? label : undefined}>
                      <Icon stroke={1.8} /><span>{label}</span>
                    </Link>
                  ))}
                </div>
              </div>;
            })}
          </nav>

          <div className="admin-sidebar-status">
            <div className="admin-connection-card">
              <span className="admin-live-dot" />
              <div><strong>{demoMode ? "Modo local ativo" : "Supabase conectado"}</strong><small>{demoMode ? "Dados neste navegador" : platformConfig.clientId}</small></div>
              <IconCloudCheck />
              <Link href="/admin/data"><IconDatabase /> Ver conexão</Link>
            </div>
            <div className={`admin-demo-card ${demoMode ? "" : "is-production"}`}>
              <IconBox />
              <div><strong>{demoMode ? "Demonstração" : "Operação ativa"}</strong><small>{demoMode ? "Não realiza vendas reais" : "Pedidos e dados reais"}</small></div>
            </div>
          </div>

          <div className="admin-sidebar-actions">
            <button className="admin-sidebar-toggle" type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"} title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}><IconChevronLeft /><span>{collapsed ? "Expandir menu" : "Recolher menu"}</span></button>
            <Link className="admin-mobile-settings" href="/admin/settings"><IconSettings /><span>Configurações</span></Link>
            <Link className="admin-sidebar-store-link" href={data.tenant.storefrontPath || "/"} target="_blank" title="Ver loja"><IconExternalLink /><span>Ver loja</span></Link>
            <form action={logoutAction} onSubmit={clearAdminSensitiveBrowserStorage}><button title="Sair"><IconLogout /><span>Sair</span></button></form>
          </div>
        </div>
      </aside>

      {open && <button className="admin-sidebar-backdrop" onClick={() => setOpen(false)} aria-label="Fechar navegação" />}

      <section className="admin-main-next">
        <header className="admin-topbar-next">
          <button className="admin-menu-toggle" onClick={() => setOpen(true)} aria-label="Abrir menu"><IconMenu2 /></button>
          <button className="admin-global-search" type="button" onClick={() => setCommandOpen(true)} aria-label="Abrir central de comandos">
            <IconSearch />
            <span>Buscar áreas, produtos, pedidos ou clientes</span>
            <kbd aria-hidden="true">⌘ K</kbd>
          </button>

          <AdminPeriodSelector />

          <div className="admin-topbar-actions">
            <AdminPwaInstall />
            <button
              className="admin-money-toggle"
              type="button"
              onClick={toggleMoneyVisibility}
              aria-label={moneyHidden ? "Mostrar valores" : "Ocultar valores"}
              aria-pressed={moneyHidden}
              title={moneyHidden ? "Mostrar valores" : "Ocultar valores"}
            >
              {moneyHidden ? <IconEyeOff /> : <IconEye />}
            </button>
            <div className="admin-popover-wrap" ref={createPopoverRef}>
              <button
                className="admin-create-button"
                onClick={() => {
                  setCreateOpen((current) => !current);
                  setNotificationsOpen(false);
                }}
                aria-expanded={createOpen}
                aria-haspopup="menu"
                aria-controls="admin-create-menu"
              >
                <IconPlus /> Criar <span /><IconChevronDown />
              </button>
              {createOpen && <div className="admin-popover admin-create-menu" id="admin-create-menu" role="menu">{visibleCreateLinks.map(({ href, label, icon: Icon }) => <Link href={href} key={label} role="menuitem"><Icon />{label}</Link>)}</div>}
            </div>
            <button
              className="admin-theme-toggle"
              type="button"
              onClick={toggleTheme}
              aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
              aria-pressed={theme === "dark"}
              title={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            >
              {theme === "dark" ? <IconSun /> : <IconMoon />}
            </button>
            <div className="admin-popover-wrap" ref={notificationsPopoverRef}>
              <AdminNotificationCenter
                open={notificationsOpen}
                onToggle={() => {
                  setNotificationsOpen((current) => !current);
                  setCreateOpen(false);
                }}
                onClose={() => setNotificationsOpen(false)}
                data={data}
                user={user}
                demoMode={demoMode}
                referenceNow={referenceNow}
                preferences={preferences}
                updatePreferences={updatePreferences}
              />
            </div>
            <Link className="admin-view-store" href={data.tenant.storefrontPath || "/"} target="_blank">Ver loja <IconExternalLink /></Link>
            <div className="admin-account">
              <span>{accountName.slice(0, 1)}</span>
              <div><strong>{accountName}</strong><small>{adminRoleLabels[user.role]} · {user.email}</small></div>
            </div>
          </div>
        </header>

        <div className="admin-content-next">
          <div className="admin-page-transition" key={pathname}>
            {pathname !== "/admin" && !productEditorPath && <div className="admin-page-heading"><div><span>{eyebrow}</span><h1>{title}</h1></div><small><IconCloudCheck /> {demoMode ? "Modo demonstrativo" : "Supabase conectado"}</small></div>}
            {children}
          </div>
        </div>
      </section>

      <nav className="admin-mobile-tabbar" aria-label="Navegação principal mobile">
        <Link className={isNavigationActive("/admin") ? "active" : ""} href="/admin" aria-label="Início"><IconHome /><span>Início</span></Link>
        <Link className={isNavigationActive("/admin/orders") ? "active" : ""} href="/admin/orders" aria-label="Pedidos"><IconReceipt2 /><span>Pedidos</span></Link>
        <Link className={isNavigationActive("/admin/products") ? "active" : ""} href="/admin/products" aria-label="Produtos"><IconTag /><span>Produtos</span></Link>
        <button className={open ? "active" : ""} type="button" onClick={() => setOpen(true)} aria-label="Abrir menu"><IconMenu2 /><span>Menu</span></button>
      </nav>
    </div>
    </AdminPeriodProvider>
  );
}
