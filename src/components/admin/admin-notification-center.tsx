"use client";

import {
  AlertTriangle,
  BellRing,
  Check,
  CheckCheck,
  Clock3,
  DatabaseZap,
  ExternalLink,
  ListTodo,
  Megaphone,
  PackageSearch,
  RotateCcw,
  Settings2,
  ShieldAlert,
  ShoppingBag,
  Truck,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { IconBell } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  adminNotificationCategories,
  type AdminNotificationCategory,
  type AdminPreferences,
} from "@/lib/admin-preferences";
import {
  adminNotificationCategoryLabels,
  adminNotificationPriorityLabels,
  type AdminNotificationPriority,
} from "@/lib/admin-notifications";
import type { AdminPermission, AdminRole, StoreData } from "@/types/store";
import { useAdminNotifications } from "./use-admin-notifications";

type NotificationTab = "important" | "all" | "settings";
type NotificationUser = { id: string; fullName: string; email: string; role: AdminRole; permissions: AdminPermission[] };

const categoryIcons: Record<AdminNotificationCategory, typeof PackageSearch> = {
  inventory: PackageSearch,
  orders: ShoppingBag,
  crm: ListTodo,
  purchasing: Truck,
  collaboration: UsersRound,
  cashback: WalletCards,
  marketing: Megaphone,
  security: ShieldAlert,
  system: DatabaseZap,
};

const priorityRank: Record<AdminNotificationPriority, number> = { critical: 3, important: 2, info: 1 };

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Agora";
  const difference = Date.now() - timestamp;
  if (Math.abs(difference) < 60_000) return "Agora";
  const future = difference < 0;
  const minutes = Math.max(1, Math.round(Math.abs(difference) / 60_000));
  if (minutes < 60) return future ? `Em ${minutes} min` : `Há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return future ? `Em ${hours} h` : `Há ${hours} h`;
  const days = Math.round(hours / 24);
  return future ? `Em ${days} dia${days === 1 ? "" : "s"}` : `Há ${days} dia${days === 1 ? "" : "s"}`;
}

export function AdminNotificationCenter({
  open,
  onToggle,
  onClose,
  data,
  user,
  demoMode,
  preferences,
  updatePreferences,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  data: StoreData;
  user: NotificationUser;
  demoMode: boolean;
  preferences: AdminPreferences;
  updatePreferences: (update: (current: AdminPreferences) => AdminPreferences) => void;
}) {
  const { notifications, markRead, markAllRead, snooze } = useAdminNotifications({ data, user, demoMode });
  const [tab, setTab] = useState<NotificationTab>("important");
  const enabledNotifications = useMemo(() => notifications.filter((notification) => !notification.snoozed && !preferences.mutedNotificationCategories.includes(notification.category)), [notifications, preferences.mutedNotificationCategories]);
  const unreadNotifications = enabledNotifications.filter((notification) => !notification.read);
  const badgeNotifications = unreadNotifications.filter((notification) => preferences.includeInformativeNotifications || notification.priority !== "info");
  const displayedNotifications = enabledNotifications.filter((notification) => tab === "all" || (tab === "important" && priorityRank[notification.priority] >= priorityRank.important));
  const criticalCount = unreadNotifications.filter((notification) => notification.priority === "critical").length;
  const badgeCount = badgeNotifications.length;

  function toggleCategory(category: AdminNotificationCategory) {
    updatePreferences((current) => ({
      ...current,
      mutedNotificationCategories: current.mutedNotificationCategories.includes(category)
        ? current.mutedNotificationCategories.filter((item) => item !== category)
        : [...current.mutedNotificationCategories, category],
    }));
  }

  return <>
    <button
      type="button"
      className={`admin-notification-button ${criticalCount ? "has-critical" : ""}`}
      onClick={onToggle}
      aria-label={badgeCount ? `Notificações, ${badgeCount} não lidas` : "Notificações"}
      aria-expanded={open}
      aria-controls="admin-notifications"
    >
      <IconBell />{badgeCount > 0 && <span>{badgeCount > 99 ? "99+" : badgeCount}</span>}
    </button>
    {open && <div className="admin-popover admin-notifications" id="admin-notifications" role="dialog" aria-label="Central de notificações">
      <header className="admin-notification-header">
        <div><span className={criticalCount ? "critical" : "stable"}>{criticalCount ? <AlertTriangle /> : <BellRing />}</span><div><strong>Central de alertas</strong><small>{unreadNotifications.length ? `${unreadNotifications.length} ${unreadNotifications.length === 1 ? "notificação não lida" : "notificações não lidas"}` : "Tudo acompanhado"}</small></div></div>
        <button type="button" onClick={onClose} aria-label="Fechar notificações"><X /></button>
      </header>

      <nav className="admin-notification-tabs" aria-label="Filtros das notificações">
        <button className={tab === "important" ? "active" : ""} onClick={() => setTab("important")}>Importantes <b>{enabledNotifications.filter((item) => item.priority !== "info").length}</b></button>
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>Todas <b>{enabledNotifications.length}</b></button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")} aria-label="Configurar notificações"><Settings2 /></button>
      </nav>

      {tab !== "settings" && <>
        <div className="admin-notification-toolbar">
          <span>{tab === "important" ? "Ações que merecem atenção" : "Alertas ativos da operação"}</span>
          <button type="button" disabled={!unreadNotifications.length} onClick={() => void markAllRead(unreadNotifications.map((item) => item.id))}><CheckCheck /> Marcar lidas</button>
        </div>
        <div className="admin-notification-list">
          {displayedNotifications.map((notification) => {
            const Icon = categoryIcons[notification.category];
            return <article className={`${notification.priority} ${notification.read ? "read" : "unread"}`} key={notification.id}>
              <div className="admin-notification-item-icon"><Icon /></div>
              <div className="admin-notification-item-copy">
                <div><span>{adminNotificationCategoryLabels[notification.category]}</span><b>{adminNotificationPriorityLabels[notification.priority]}</b><time>{relativeTime(notification.createdAt)}</time></div>
                <strong>{notification.title}</strong>
                <p>{notification.description}</p>
                <footer>
                  <Link href={notification.href} onClick={() => { void markRead(notification.id); onClose(); }}>Abrir <ExternalLink /></Link>
                  <button type="button" onClick={() => void markRead(notification.id, !notification.read)}>{notification.read ? <RotateCcw /> : <Check />}{notification.read ? "Marcar não lida" : "Marcar lida"}</button>
                  <button type="button" onClick={() => void snooze(notification)}><Clock3 /> Adiar 24h</button>
                </footer>
              </div>
            </article>;
          })}
          {!displayedNotifications.length && <div className="admin-notification-empty"><CheckCheck /><strong>Nenhum alerta neste filtro.</strong><span>Quando algo exigir atenção, ele aparecerá aqui com um atalho para resolver.</span></div>}
        </div>
      </>}

      {tab === "settings" && <section className="admin-notification-settings">
        <header><Settings2 /><div><strong>Preferências individuais</strong><span>Escolha o que deve aparecer para esta conta.</span></div></header>
        <div>{adminNotificationCategories.map((category) => <label key={category}><input type="checkbox" checked={!preferences.mutedNotificationCategories.includes(category)} onChange={() => toggleCategory(category)} /><span><b>{adminNotificationCategoryLabels[category]}</b><small>{category === "system" ? "Backup, banco e disponibilidade" : category === "security" ? "MFA e alterações de acesso" : `Alertas de ${adminNotificationCategoryLabels[category].toLowerCase()}`}</small></span></label>)}</div>
        <label className="admin-notification-info-toggle"><input type="checkbox" checked={preferences.includeInformativeNotifications} onChange={(event) => updatePreferences((current) => ({ ...current, includeInformativeNotifications: event.target.checked }))} /><span><b>Contar alertas informativos no sino</b><small>Eles continuam disponíveis na aba “Todas” quando esta opção está desligada.</small></span></label>
      </section>}
    </div>}
  </>;
}
