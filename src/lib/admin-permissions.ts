import type { AdminPermission, AdminRole } from "@/types/store";

export const adminPermissionCatalog: Array<{
  key: AdminPermission;
  label: string;
  description: string;
}> = [
  { key: "dashboard", label: "Visão geral", description: "Indicadores, prioridades e atividade recente." },
  { key: "orders", label: "Pedidos", description: "Consultar pedidos e atualizar seus status." },
  { key: "catalog", label: "Catálogo", description: "Produtos, categorias, estoque e ordenação." },
  { key: "store", label: "Loja e layout", description: "Páginas, containers, banners e conteúdo da home." },
  { key: "marketing", label: "Marketing", description: "Cupons e mensagens automáticas." },
  { key: "settings", label: "Configurações", description: "Identidade visual e regras operacionais." },
  { key: "data", label: "Dados e backup", description: "Importação, exportação e limpeza de dados." },
  { key: "users", label: "Usuários e permissões", description: "Criar contas e controlar acessos da equipe." },
];

export const allAdminPermissions = adminPermissionCatalog.map((item) => item.key);

export const adminRoleLabels: Record<AdminRole, string> = {
  owner: "Proprietário",
  manager: "Gerente",
  editor: "Editor",
  support: "Atendimento",
  viewer: "Visualizador",
};

export const adminRolePermissions: Record<AdminRole, AdminPermission[]> = {
  owner: allAdminPermissions,
  manager: ["dashboard", "orders", "catalog", "store", "marketing", "settings", "data"],
  editor: ["dashboard", "catalog", "store", "marketing"],
  support: ["dashboard", "orders"],
  viewer: ["dashboard"],
};

export const sectionPermissions: Record<string, AdminPermission> = {
  orders: "orders",
  products: "catalog",
  categories: "catalog",
  layout: "store",
  sections: "store",
  banners: "store",
  coupons: "marketing",
  messages: "marketing",
  settings: "settings",
  data: "data",
  users: "users",
};

export function hasAdminPermission(
  role: AdminRole,
  permissions: AdminPermission[],
  permission: AdminPermission,
) {
  return role === "owner" || permissions.includes(permission);
}

export function firstAllowedAdminPath(role: AdminRole, permissions: AdminPermission[]) {
  if (hasAdminPermission(role, permissions, "dashboard")) return "/admin";
  const match = Object.entries(sectionPermissions).find(([, permission]) => hasAdminPermission(role, permissions, permission));
  return match ? `/admin/${match[0]}` : "/admin/login";
}
