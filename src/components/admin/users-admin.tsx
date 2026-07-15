"use client";

import {
  IconCheck,
  IconKey,
  IconLock,
  IconPencil,
  IconPlus,
  IconSearch,
  IconShieldCheck,
  IconTrash,
  IconUserCheck,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAdminData } from "@/components/admin/admin-data-provider";
import { AdminPanel } from "@/components/admin/admin-ui";
import { useAdminDialog } from "@/components/admin/use-admin-dialog";
import { useConfirm } from "@/components/providers/confirm-provider";
import { adminPermissionCatalog, adminRoleLabels, adminRolePermissions } from "@/lib/admin-permissions";
import { formatDateTime } from "@/lib/format";
import { adminUserCreateSchema, adminUserUpdateSchema } from "@/lib/validation";
import type { AdminPermission, AdminRole, AdminUser } from "@/types/store";

const roles: AdminRole[] = ["owner", "manager", "editor", "support", "viewer"];

function UserEditor({ user, canCreateOwner, onClose }: { user?: AdminUser; canCreateOwner: boolean; onClose: () => void }) {
  const { createAdminUser, updateAdminUser } = useAdminData();
  const [form, setForm] = useState({
    id: user?.id ?? "",
    fullName: user?.fullName ?? "",
    email: user?.email ?? "",
    password: "",
    role: user?.role ?? "manager" as AdminRole,
    permissions: user?.permissions ?? adminRolePermissions.manager,
    active: user?.active ?? true,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const panelRef = useAdminDialog(onClose);
  const field = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((current) => ({ ...current, [key]: value }));
  const togglePermission = (permission: AdminPermission) => field("permissions", form.permissions.includes(permission) ? form.permissions.filter((item) => item !== permission) : [...form.permissions, permission]);

  return (
    <div className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="user-editor-title">
      <button className="admin-modal-overlay" onClick={onClose} aria-label="Fechar" />
      <div className="admin-modal-panel user-editor-modal" ref={panelRef}>
        <header>
          <div><span>EQUIPE</span><h2 id="user-editor-title">{user ? "Editar usuário" : "Novo usuário"}</h2><small>{user ? "Atualize o cargo, o status e as áreas liberadas." : "Crie uma conta com senha temporária e acesso personalizado."}</small></div>
          <button onClick={onClose} aria-label="Fechar"><IconX /></button>
        </header>
        <form className="admin-form" onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          const payload = { fullName: form.fullName, email: form.email, password: form.password, role: form.role, permissions: form.permissions, active: form.active };
          const parsed = user ? adminUserUpdateSchema.safeParse({ ...payload, id: form.id }) : adminUserCreateSchema.safeParse(payload);
          if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Revise os dados."); return; }
          setSaving(true);
          try {
            if (user) await updateAdminUser(parsed.data as ReturnType<typeof adminUserUpdateSchema.parse>);
            else await createAdminUser(parsed.data as ReturnType<typeof adminUserCreateSchema.parse>);
            onClose();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Não foi possível salvar o usuário.");
          } finally {
            setSaving(false);
          }
        }}>
          <label>Nome completo<input value={form.fullName} onChange={(event) => field("fullName", event.target.value)} autoFocus /></label>
          <label>E-mail<input type="email" value={form.email} disabled={Boolean(user)} onChange={(event) => field("email", event.target.value)} /></label>
          {!user && <label className="full">Senha temporária<input type="password" value={form.password} onChange={(event) => field("password", event.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" /><small className="field-hint">Compartilhe esta senha por um canal seguro. O usuário poderá alterá-la depois.</small></label>}
          <label>Cargo<select value={form.role} onChange={(event) => { const role = event.target.value as AdminRole; field("role", role); field("permissions", adminRolePermissions[role]); }} disabled={user?.isCurrent}>
            {roles.filter((role) => role !== "owner" || canCreateOwner || user?.role === "owner").map((role) => <option value={role} key={role}>{adminRoleLabels[role]}</option>)}
          </select></label>
          <label className="check-field"><input type="checkbox" checked={form.active} disabled={user?.isCurrent} onChange={(event) => field("active", event.target.checked)} /> Acesso ativo</label>
          <div className="admin-form-section full"><strong>Permissões deste usuário</strong><span>Cada opção libera a visualização e o gerenciamento daquele módulo.</span></div>
          <div className="permission-picker full">
            {adminPermissionCatalog.map((permission) => {
              const checked = form.role === "owner" || form.permissions.includes(permission.key);
              return <label className={checked ? "selected" : ""} key={permission.key}><input type="checkbox" checked={checked} disabled={form.role === "owner"} onChange={() => togglePermission(permission.key)} /><span><strong>{permission.label}</strong><small>{permission.description}</small></span>{checked && <IconCheck />}</label>;
            })}
          </div>
          {error && <p className="admin-form-error full" role="alert">{error}</p>}
          <div className="admin-form-actions full"><button type="button" className="admin-button" onClick={onClose}>Cancelar</button><button className="admin-button primary" disabled={saving}>{saving ? "Salvando..." : user ? "Salvar acesso" : "Criar usuário"}</button></div>
        </form>
      </div>
    </div>
  );
}

export function UsersAdmin() {
  const { data, currentUser, refreshTeamMembers, deleteAdminUser } = useAdminData();
  const confirm = useConfirm();
  const searchParams = useSearchParams();
  const [editor, setEditor] = useState<AdminUser | "new" | null>(searchParams.get("novo") === "1" ? "new" : null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    refreshTeamMembers().catch((error) => setLoadError(error instanceof Error ? error.message : "Não foi possível atualizar a equipe.")).finally(() => setLoading(false));
  }, [refreshTeamMembers]);

  const users = data.teamMembers;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return users.filter((user) => {
      const matchesQuery = !normalized || `${user.fullName} ${user.email} ${adminRoleLabels[user.role]}`.toLocaleLowerCase("pt-BR").includes(normalized);
      return matchesQuery
        && (roleFilter === "all" || user.role === roleFilter)
        && (statusFilter === "all" || (statusFilter === "active" ? user.active : !user.active));
    });
  }, [query, roleFilter, statusFilter, users]);
  const activeUsers = users.filter((user) => user.active).length;
  const privilegedUsers = users.filter((user) => ["owner", "manager"].includes(user.role)).length;

  return (
    <div className="users-admin">
      <div className="admin-inline-note users-security-note"><IconShieldCheck /><div><strong>Acessos protegidos pelo Supabase</strong><span>As permissões controlam o menu, as rotas administrativas e as regras de acesso ao banco.</span></div></div>
      <div className="message-stats users-stats">
        <article><span>Usuários cadastrados</span><strong>{users.length}</strong><small>contas da equipe</small></article>
        <article><span>Acessos ativos</span><strong>{activeUsers}</strong><small>{users.length - activeUsers} suspensos</small></article>
        <article><span>Gestores</span><strong>{privilegedUsers}</strong><small>proprietários e gerentes</small></article>
      </div>

      <AdminPanel title="Equipe da loja" description="Crie usuários, suspenda acessos e personalize as permissões de cada pessoa." action={<button className="admin-button primary" onClick={() => setEditor("new")}><IconPlus /> Novo usuário</button>}>
        <div className="users-toolbar">
          <label><IconSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nome, e-mail ou cargo" aria-label="Buscar usuários" /></label>
          <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filtrar por cargo"><option value="all">Todos os cargos</option>{roles.map((role) => <option value={role} key={role}>{adminRoleLabels[role]}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por status"><option value="all">Todos os acessos</option><option value="active">Ativos</option><option value="inactive">Suspensos</option></select>
          <span>{loading ? "Atualizando..." : `${filtered.length} usuário${filtered.length === 1 ? "" : "s"}`}</span>
        </div>
        {loadError && <p className="admin-form-error users-load-error" role="alert">{loadError}</p>}
        <div className="users-list">
          {filtered.map((user) => (
            <article className="user-row" key={user.id}>
              <div className="user-avatar">{user.fullName.slice(0, 1).toUpperCase()}</div>
              <div className="user-main"><div><strong>{user.fullName}</strong>{user.isCurrent && <span className="current-user-tag">Você</span>}</div><small>{user.email}</small></div>
              <div className="user-role"><span>{adminRoleLabels[user.role]}</span><small>{user.permissions.length || adminPermissionCatalog.length} módulos</small></div>
              <div className="user-last-access"><span>Último acesso</span><small>{user.lastSignInAt ? formatDateTime(user.lastSignInAt) : "Ainda não acessou"}</small></div>
              <span className={`status-tag ${user.active ? "" : "off"}`}>{user.active ? "Ativo" : "Suspenso"}</span>
              <div className="admin-actions"><button onClick={() => setEditor(user)} title="Editar usuário" aria-label={`Editar ${user.fullName}`}><IconPencil /></button><button className="danger" title="Excluir" aria-label={`Excluir ${user.fullName}`} disabled={user.isCurrent} onClick={async () => { const accepted = await confirm({ title: "Excluir usuário?", description: `O acesso de ${user.fullName} será removido permanentemente.`, confirmLabel: "Excluir acesso", danger: true }); if (accepted) await deleteAdminUser(user.id); }}><IconTrash /></button></div>
            </article>
          ))}
          {!filtered.length && <div className="admin-empty"><IconUsers /><strong>Nenhum usuário encontrado.</strong><span>Ajuste a busca ou crie um novo acesso.</span></div>}
        </div>
      </AdminPanel>

      <div className="users-guide">
        <article><IconUserCheck /><div><strong>Cargos como ponto de partida</strong><span>Escolha um cargo para preencher as permissões recomendadas e personalize quando necessário.</span></div></article>
        <article><IconKey /><div><strong>Senha temporária</strong><span>Novas contas são criadas com uma senha inicial que deve ser compartilhada com segurança.</span></div></article>
        <article><IconLock /><div><strong>Suspensão imediata</strong><span>Ao suspender um usuário, novas tentativas e sessões administrativas deixam de ter acesso.</span></div></article>
      </div>

      {editor && <UserEditor user={editor === "new" ? undefined : editor} canCreateOwner={currentUser.role === "owner"} onClose={() => setEditor(null)} />}
    </div>
  );
}
