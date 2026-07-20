"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isPresenceOnline, mapTeamPresence, type TeamPresence } from "@/lib/collaboration";
import { useAdminData } from "./admin-data-provider";

export function useTeamPresence(subscribe = false) {
  const { data, currentUser, demoMode } = useAdminData();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [presence, setPresence] = useState<TeamPresence[]>([]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setPresence([{ userId: currentUser.id, email: currentUser.email, fullName: currentUser.fullName, route: pathname, entityType: "", entityId: "", lastSeenAt: new Date().toISOString() }]);
      return;
    }
    const recentThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabase
      .from("team_presence")
      .select("*")
      .eq("tenant_id", data.tenant.id)
      .gte("last_seen_at", recentThreshold)
      .order("last_seen_at", { ascending: false });
    if (rows) setPresence(rows.map((row) => mapTeamPresence(row as Record<string, unknown>)));
  }, [currentUser.email, currentUser.fullName, currentUser.id, data.tenant.id, pathname, supabase]);

  useEffect(() => {
    const heartbeat = async () => {
      if (!supabase) {
        await refresh();
        return;
      }
      await supabase.rpc("heartbeat_team_presence", {
        p_tenant_id: data.tenant.id,
        p_email: currentUser.email,
        p_full_name: currentUser.fullName,
        p_route: pathname,
        p_entity_type: pathname.startsWith("/admin/products/") ? "product" : "",
        p_entity_id: pathname.startsWith("/admin/products/") ? pathname.split("/").at(-1) ?? "" : "",
      });
      if (subscribe) await refresh();
    };
    void heartbeat();
    const timer = window.setInterval(() => void heartbeat(), 30_000);
    return () => window.clearInterval(timer);
  }, [currentUser.email, currentUser.fullName, data.tenant.id, pathname, refresh, subscribe, supabase]);

  useEffect(() => {
    if (!supabase || !subscribe) return;
    void refresh();
    const channel = supabase.channel(`team-presence-${data.tenant.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_presence", filter: `tenant_id=eq.${data.tenant.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [data.tenant.id, refresh, subscribe, supabase]);

  return { presence, online: presence.filter((item) => isPresenceOnline(item.lastSeenAt)), refresh, demoMode };
}

export function TeamPresencePulse() {
  useTeamPresence(false);
  return null;
}
