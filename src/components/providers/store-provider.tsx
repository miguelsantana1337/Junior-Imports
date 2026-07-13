"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Order, StoreData } from "@/types/store";
import { createMessageLogs } from "@/lib/message-automation";

const DEMO_DATA_KEY = "juniorImportsNextDemoData";

interface StoreContextValue {
  data: StoreData;
  demoMode: boolean;
  setData: React.Dispatch<React.SetStateAction<StoreData>>;
  addOrder: (order: Order) => void;
  resetData: () => void;
  importData: (data: StoreData) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function normalizeData(candidate: StoreData, fallback: StoreData): StoreData {
  return {
    ...fallback,
    ...candidate,
    settings: { ...fallback.settings, ...candidate.settings },
    pages: candidate.pages ?? fallback.pages,
    pageBlocks: candidate.pageBlocks ?? fallback.pageBlocks,
    messageAutomations: candidate.messageAutomations ?? fallback.messageAutomations,
    messageLogs: candidate.messageLogs ?? fallback.messageLogs,
    teamMembers: candidate.teamMembers ?? fallback.teamMembers,
  };
}

export function StoreProvider({
  initialData,
  children,
}: {
  initialData: StoreData;
  children: ReactNode;
}) {
  const demoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [data, setData] = useState(initialData);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initialData);

  useEffect(() => {
    if (demoMode) {
      try {
        const stored = window.localStorage.getItem(DEMO_DATA_KEY);
        if (stored) setData(normalizeData(JSON.parse(stored) as StoreData, initialRef.current));
      } catch {
        window.localStorage.removeItem(DEMO_DATA_KEY);
      }
    }
    setHydrated(true);
  }, [demoMode]);

  useEffect(() => {
    if (demoMode && hydrated) {
      window.localStorage.setItem(DEMO_DATA_KEY, JSON.stringify(data));
    }
  }, [data, demoMode, hydrated]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--primary", data.settings.primaryColor || "#1677ff");
    root.style.setProperty("--primary-2", data.settings.secondaryColor || "#69a8ff");
    root.style.setProperty("--bg", data.settings.backgroundColor || "#07090d");
    root.style.setProperty("--text", data.settings.textColor || "#f5f7fb");
    root.style.setProperty("--container", `${data.settings.contentWidth || 1240}px`);
    root.style.setProperty("--radius", `${data.settings.borderRadius || 22}px`);
    root.dataset.storeFont = data.settings.fontFamily || "Inter";
    root.dataset.headerLayout = data.settings.headerLayout || "left";
  }, [data.settings]);

  const addOrder = useCallback((order: Order) => {
    setData((current) => ({
      ...current,
      orders: [order, ...current.orders],
      messageLogs: [
        ...createMessageLogs(order, current.messageAutomations ?? []),
        ...(current.messageLogs ?? []),
      ],
    }));
  }, []);

  const resetData = useCallback(() => setData(structuredClone(initialRef.current)), []);
  const importData = useCallback((next: StoreData) => setData(next), []);

  const value = useMemo(
    () => ({ data, demoMode, setData, addOrder, resetData, importData }),
    [data, demoMode, addOrder, resetData, importData],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useStore must be used inside StoreProvider");
  return context;
}
