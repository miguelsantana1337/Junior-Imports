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
        if (stored) setData(JSON.parse(stored) as StoreData);
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
    document.documentElement.style.setProperty(
      "--primary",
      data.settings.primaryColor || "#1677ff",
    );
  }, [data.settings.primaryColor]);

  const addOrder = useCallback((order: Order) => {
    setData((current) => ({ ...current, orders: [order, ...current.orders] }));
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
