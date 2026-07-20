"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { hasAdminPermission } from "@/lib/admin-permissions";
import {
  buildAdminNotifications,
  sortAdminNotifications,
  type AdminNotification,
} from "@/lib/admin-notifications";
import type { AdminHealthReport } from "@/lib/admin-health";
import { createClient } from "@/lib/supabase/client";
import type { AdminPermission, AdminRole, StoreData } from "@/types/store";

type NotificationUser = {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
};

type InteractionState = {
  readAt: string;
  snoozedUntil: string;
};

export type AdminNotificationView = AdminNotification & {
  read: boolean;
  snoozed: boolean;
};

const storagePrefix = "junior-imports:admin-notifications:v1";

function storageKey(tenantId: string, userId: string) {
  return `${storagePrefix}:${tenantId}:${userId}`;
}

function normalizeStates(value: unknown): Record<string, InteractionState> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).flatMap(([key, state]) => {
    if (!state || typeof state !== "object" || key.length < 3 || key.length > 240) return [];
    const candidate = state as Partial<InteractionState>;
    return [[key, {
      readAt: typeof candidate.readAt === "string" ? candidate.readAt : "",
      snoozedUntil: typeof candidate.snoozedUntil === "string" ? candidate.snoozedUntil : "",
    }]];
  }));
}

function readLocalStates(key: string) {
  try {
    return normalizeStates(JSON.parse(window.localStorage.getItem(key) || "{}"));
  } catch {
    return {};
  }
}

function writeLocalStates(key: string, states: Record<string, InteractionState>) {
  try {
    window.localStorage.setItem(key, JSON.stringify(states));
  } catch {
    // O painel continua funcional mesmo quando o navegador bloqueia persistência.
  }
}

function dayKey(now: number) {
  return new Date(now).toISOString().slice(0, 10);
}

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function snoozeKey(notification: Pick<AdminNotification, "category" | "sourceId">) {
  return `__snooze__:${notification.category}:${notification.sourceId}`.slice(0, 240);
}

export function useAdminNotifications({
  data,
  user,
  demoMode,
}: {
  data: StoreData;
  user: NotificationUser;
  demoMode: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const localKey = storageKey(data.tenant.id, user.id);
  const [states, setStates] = useState<Record<string, InteractionState>>({});
  const [health, setHealth] = useState<AdminHealthReport | null>(null);
  const [collaborationNotifications, setCollaborationNotifications] = useState<AdminNotification[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  const canAccessData = hasAdminPermission(user.role, user.permissions, "data");
  const canCollaborate = hasAdminPermission(user.role, user.permissions, "collaboration");

  const loadStates = useCallback(async () => {
    if (!supabase) {
      setStates(readLocalStates(localKey));
      return;
    }
    const { data: rows, error } = await supabase
      .from("admin_notification_states")
      .select("notification_key, read_at, snoozed_until")
      .eq("tenant_id", data.tenant.id)
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(500);
    if (error) {
      setStates(readLocalStates(localKey));
      return;
    }
    setStates(Object.fromEntries((rows ?? []).map((row) => [String(row.notification_key), {
      readAt: String(row.read_at ?? ""),
      snoozedUntil: String(row.snoozed_until ?? ""),
    }])));
  }, [data.tenant.id, localKey, supabase, user.id]);

  useEffect(() => {
    void loadStates();
    if (!supabase) return;
    const channel = supabase.channel(`admin-notifications-${data.tenant.id}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_notification_states", filter: `user_id=eq.${user.id}` }, () => void loadStates())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data.tenant.id, loadStates, supabase, user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (demoMode || !canAccessData) {
      setHealth(null);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/health", { cache: "no-store", headers: { Accept: "application/json" } });
        if (response.ok && active) setHealth(await response.json() as AdminHealthReport);
      } catch {
        if (active) setHealth(null);
      }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [canAccessData, demoMode]);

  const refreshCollaboration = useCallback(async () => {
    if (!supabase || !canCollaborate) {
      setCollaborationNotifications([]);
      return;
    }
    const [approvalResult, threadResult, commentResult, readResult] = await Promise.all([
      supabase.from("approval_requests").select("id, entity_label, request_note, requested_by_email, reviewer_email, status, due_at, created_at").eq("tenant_id", data.tenant.id).eq("status", "pending").limit(100),
      supabase.from("collaboration_threads").select("id, title").eq("tenant_id", data.tenant.id).limit(200),
      supabase.from("collaboration_comments").select("id, thread_id, body, mentions, actor_email, created_at").eq("tenant_id", data.tenant.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("collaboration_reads").select("comment_id").eq("tenant_id", data.tenant.id).eq("user_id", user.id).limit(500),
    ]);
    if (approvalResult.error || threadResult.error || commentResult.error) return;

    const currentEmail = user.email.toLowerCase();
    const username = currentEmail.split("@")[0];
    const privileged = user.role === "owner" || user.role === "manager";
    const evaluatedAt = Date.now();
    const readComments = new Set((readResult.data ?? []).map((row) => String(row.comment_id)));
    const threads = new Map((threadResult.data ?? []).map((row) => [String(row.id), String(row.title)]));
    const next: AdminNotification[] = [];

    for (const approval of approvalResult.data ?? []) {
      const reviewer = String(approval.reviewer_email ?? "").toLowerCase();
      const requester = String(approval.requested_by_email ?? "").toLowerCase();
      if (!privileged && (requester === currentEmail || (reviewer && reviewer !== currentEmail))) continue;
      const dueAt = String(approval.due_at ?? "");
      const overdue = Boolean(dueAt && (timestamp(dueAt) ?? evaluatedAt) < evaluatedAt);
      const priority = overdue ? "critical" as const : "important" as const;
      next.push({
        id: `collaboration:approval:${approval.id}:${priority}:${dayKey(evaluatedAt)}`,
        category: "collaboration",
        priority,
        title: overdue ? `Aprovação atrasada: ${approval.entity_label}` : `Aprovação solicitada: ${approval.entity_label}`,
        description: String(approval.request_note || `Solicitado por ${approval.requested_by_email}`),
        href: "/admin/collaboration",
        createdAt: dueAt || String(approval.created_at),
        sourceId: String(approval.id),
      });
    }

    for (const comment of commentResult.data ?? []) {
      const id = String(comment.id);
      const actorEmail = String(comment.actor_email ?? "").toLowerCase();
      const mentions = Array.isArray(comment.mentions) ? comment.mentions.map((value) => String(value).toLowerCase()) : [];
      if (readComments.has(id) || actorEmail === currentEmail || !mentions.some((mention) => mention === currentEmail || mention === username)) continue;
      next.push({
        id: `collaboration:mention:${id}`,
        category: "collaboration",
        priority: "important",
        title: `Você foi mencionado em ${threads.get(String(comment.thread_id)) || "uma discussão"}`,
        description: String(comment.body),
        href: "/admin/collaboration",
        createdAt: String(comment.created_at),
        sourceId: id,
      });
    }

    setCollaborationNotifications(sortAdminNotifications(next));
  }, [canCollaborate, data.tenant.id, supabase, user.email, user.id, user.role]);

  useEffect(() => {
    void refreshCollaboration();
    if (!supabase || !canCollaborate) return;
    const channel = supabase.channel(`notification-collaboration-${data.tenant.id}-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests", filter: `tenant_id=eq.${data.tenant.id}` }, () => void refreshCollaboration())
      .on("postgres_changes", { event: "*", schema: "public", table: "collaboration_comments", filter: `tenant_id=eq.${data.tenant.id}` }, () => void refreshCollaboration())
      .on("postgres_changes", { event: "*", schema: "public", table: "collaboration_reads", filter: `user_id=eq.${user.id}` }, () => void refreshCollaboration())
      .subscribe();
    const timer = window.setInterval(() => void refreshCollaboration(), 5 * 60_000);
    return () => { window.clearInterval(timer); void supabase.removeChannel(channel); };
  }, [canCollaborate, data.tenant.id, refreshCollaboration, supabase, user.id]);

  const rawNotifications = useMemo(() => sortAdminNotifications([
    ...buildAdminNotifications(data, user, { now: clock, health }),
    ...collaborationNotifications,
  ]), [clock, collaborationNotifications, data, health, user]);

  const notifications = useMemo<AdminNotificationView[]>(() => rawNotifications.map((notification) => {
    const state = states[notification.id];
    const snoozeState = states[snoozeKey(notification)];
    return {
      ...notification,
      read: Boolean(state?.readAt),
      snoozed: Boolean((snoozeState?.snoozedUntil || state?.snoozedUntil) && (timestamp(snoozeState?.snoozedUntil || state?.snoozedUntil || "") ?? 0) > clock),
    };
  }), [clock, rawNotifications, states]);

  const persistStates = useCallback(async (changes: Record<string, InteractionState>) => {
    const next = { ...states, ...changes };
    setStates(next);
    writeLocalStates(localKey, next);
    if (!supabase) return;
    const rows = Object.entries(changes).map(([notificationKey, state]) => ({
      tenant_id: data.tenant.id,
      user_id: user.id,
      notification_key: notificationKey,
      read_at: state.readAt || null,
      snoozed_until: state.snoozedUntil || null,
    }));
    if (!rows.length) return;
    await supabase.from("admin_notification_states").upsert(rows, { onConflict: "tenant_id,user_id,notification_key" });
  }, [data.tenant.id, localKey, states, supabase, user.id]);

  const markRead = useCallback((notificationId: string, read = true) => persistStates({
    [notificationId]: {
      readAt: read ? new Date().toISOString() : "",
      snoozedUntil: states[notificationId]?.snoozedUntil ?? "",
    },
  }), [persistStates, states]);

  const markAllRead = useCallback((notificationIds: string[]) => {
    const readAt = new Date().toISOString();
    return persistStates(Object.fromEntries(notificationIds.map((id) => [id, {
      readAt,
      snoozedUntil: states[id]?.snoozedUntil ?? "",
    }])));
  }, [persistStates, states]);

  const snooze = useCallback((notification: Pick<AdminNotification, "category" | "sourceId">, hours = 24) => persistStates({
    [snoozeKey(notification)]: {
      readAt: "",
      snoozedUntil: new Date(Date.now() + hours * 3_600_000).toISOString(),
    },
  }), [persistStates]);

  return { notifications, markRead, markAllRead, snooze };
}
