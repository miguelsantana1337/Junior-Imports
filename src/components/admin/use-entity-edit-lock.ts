"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdminData } from "./admin-data-provider";

export interface EntityEditLockState {
  status: "idle" | "acquired" | "locked" | "unavailable";
  email: string;
  fullName: string;
  expiresAt: string;
}

export function useEntityEditLock(entityType: string, entityId?: string) {
  const { data, currentUser, demoMode } = useAdminData();
  const supabase = useMemo(() => createClient(), []);
  const [lock, setLock] = useState<EntityEditLockState>({ status: "idle", email: "", fullName: "", expiresAt: "" });

  useEffect(() => {
    if (!entityId || entityId === "new-product") return;
    if (demoMode || !supabase) {
      setLock({ status: "acquired", email: currentUser.email, fullName: currentUser.fullName, expiresAt: "" });
      return;
    }
    let active = true;
    const acquire = async () => {
      const { data: response, error } = await supabase.rpc("acquire_entity_edit_lock", {
        p_tenant_id: data.tenant.id,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_email: currentUser.email,
        p_full_name: currentUser.fullName,
        p_route: window.location.pathname,
      });
      if (!active) return;
      if (error || !response || typeof response !== "object") {
        setLock({ status: "unavailable", email: "", fullName: "", expiresAt: "" });
        return;
      }
      const result = response as Record<string, unknown>;
      setLock({ status: result.acquired ? "acquired" : "locked", email: String(result.email ?? ""), fullName: String(result.fullName ?? ""), expiresAt: String(result.expiresAt ?? "") });
    };
    void acquire();
    const timer = window.setInterval(() => void acquire(), 45_000);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.rpc("release_entity_edit_lock", { p_tenant_id: data.tenant.id, p_entity_type: entityType, p_entity_id: entityId });
    };
  }, [currentUser.email, currentUser.fullName, data.tenant.id, demoMode, entityId, entityType, supabase]);

  return lock;
}
