"use client";

import {
  BadgePercent,
  Boxes,
  ClipboardList,
  Database,
  ExternalLink,
  Images,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  Tags,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { logoutAction } from "@/app/admin/auth-actions";

const navigation = [
  { href: "/admin", label: "Visão geral", icon: LayoutDashboard },
  { href: "/admin/products", label: "Produtos", icon: PackageSearch },
  { href: "/admin/banners", label: "Banners", icon: Images },
  { href: "/admin/categories", label: "Categorias", icon: Tags },
  { href: "/admin/sections", label: "Página inicial", icon: Boxes },
  { href: "/admin/coupons", label: "Cupons", icon: BadgePercent },
  { href: "/admin/orders", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
  { href: "/admin/data", label: "Dados", icon: Database },
];

const titles: Record<string, [string, string]> = {
  "/admin": ["PAINEL", "Visão geral"],
  "/admin/products": ["CATALOGO", "Produtos"],
  "/admin/banners": ["PAGINA INICIAL", "Banners rotativos"],
  "/admin/categories": ["ORGANIZACAO", "Categorias"],
  "/admin/sections": ["PÁGINA INICIAL", "Ordem das seções"],
  "/admin/coupons": ["PROMOCOES", "Cupons"],
  "/admin/orders": ["VENDAS", "Pedidos demonstrativos"],
  "/admin/settings": ["LOJA", "Configurações"],
  "/admin/data": ["MANUTENCAO", "Dados e backup"],
};

export function AdminShell({ children, email, demoMode }: { children: ReactNode; email: string; demoMode: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [eyebrow, title] = titles[pathname] ?? titles["/admin"];
  return (
    <div className="admin-shell-next">
      <aside className={`admin-sidebar-next ${open ? "open" : ""}`}>
        <div className="admin-brand"><span>JI</span><div><strong>Junior Imports</strong><small>Painel Next</small></div><button onClick={() => setOpen(false)} aria-label="Fechar menu"><X /></button></div>
        <nav>{navigation.map(({ href, label, icon: Icon }) => <Link className={pathname === href ? "active" : ""} href={href} key={href} onClick={() => setOpen(false)}><Icon />{label}</Link>)}</nav>
        <div className="admin-sidebar-bottom"><Link href="/" target="_blank"><ExternalLink /> Ver loja</Link><form action={logoutAction}><button><LogOut /> Sair</button></form></div>
      </aside>
      <section className="admin-main-next">
        <header className="admin-topbar-next"><div className="admin-title"><button className="admin-menu-toggle" onClick={() => setOpen(true)} aria-label="Abrir menu"><Menu /></button><div><span>{eyebrow}</span><h1>{title}</h1></div></div><div className="admin-account"><span>{demoMode ? "Modo demonstrativo" : "Supabase"}</span><small>{email}</small></div></header>
        <div className="admin-content-next">{children}</div>
      </section>
    </div>
  );
}
