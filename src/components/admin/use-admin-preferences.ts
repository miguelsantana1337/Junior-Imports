"use client";

import { useCallback, useEffect, useState } from "react";
import {
  defaultAdminPreferences,
  readAdminPreferences,
  writeAdminPreferences,
  type AdminPreferences,
} from "@/lib/admin-preferences";

const preferencesEvent = "junior-imports:admin-preferences-changed";

export function useAdminPreferences(userId: string) {
  const [preferences, setPreferences] = useState<AdminPreferences>(defaultAdminPreferences);

  useEffect(() => {
    setPreferences(readAdminPreferences(userId));

    const synchronize = (event: Event) => {
      if (event instanceof CustomEvent && event.detail?.userId && event.detail.userId !== userId) return;
      setPreferences(readAdminPreferences(userId));
    };
    window.addEventListener("storage", synchronize);
    window.addEventListener(preferencesEvent, synchronize);
    return () => {
      window.removeEventListener("storage", synchronize);
      window.removeEventListener(preferencesEvent, synchronize);
    };
  }, [userId]);

  const updatePreferences = useCallback((update: (current: AdminPreferences) => AdminPreferences) => {
    const current = readAdminPreferences(userId);
    const next = writeAdminPreferences(userId, update(current));
    setPreferences(next);
    window.dispatchEvent(new CustomEvent(preferencesEvent, { detail: { userId } }));
  }, [userId]);

  return { preferences, updatePreferences };
}
