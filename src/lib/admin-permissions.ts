import type { AdminPermission, AdminRole } from "@/types/store";

export const adminPermissionCatalog: Array<{
  key: AdminPermission;
  label: string;
  description: string;
}> = [
  { key: "dashboard", label: "Visão geral", description: "Indicadores, prioridades e atividade recente." },
  { key: "audit", label: "Auditoria de segurança", description: "Consultar eventos administrativos minimizados e rastreáveis." },
  { key: "crm", label: "CRM operacional", description: "Tarefas, contatos, carteira, segmentos e acompanhamento diário." },
  { key: "customers", label: "Clientes e CRM", description: "Cadastro, histórico, recorrência e relacionamento com clientes." },
  { key: "orders", label: "Pedidos", description: "Consultar pedidos e atualizar seus status." },
  { key: "finance", label: "Financeiro", description: "Custos, lançamentos, contas, margem, caixa e relatórios." },
  { key: "inventory", label: "Estoque e lotes", description: "Movimentos, saldos, inventário, estoque mínimo e validade." },
  { key: "purchasing", label: "Compras e fornecedores", description: "Fornecedores, ordens de compra e recebimentos." },
  { key: "reports", label: "Relatórios e exportações", description: "Indicadores consolidados, comparativos, relatórios salvos e arquivos exportados." },
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
  manager: ["dashboard", "crm", "customers", "orders", "finance", "inventory", "purchasing", "reports", "catalog", "store", "marketing", "settings", "data"],
  editor: ["dashboard", "catalog", "store", "marketing"],
  support: ["dashboard", "crm", "customers", "orders"],
  viewer: ["dashboard"],
};

export const sectionPermissions: Record<string, AdminPermission> = {
  customers: "customers",
  crm: "crm",
  orders: "orders",
  finance: "finance",
  inventory: "inventory",
  purchasing: "purchasing",
  reports: "reports",
  import: "catalog",
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
