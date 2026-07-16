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
import { applyCreatedOrder } from "@/lib/order-state";

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
    tenant: { ...fallback.tenant, ...candidate.tenant },
    settings: { ...fallback.settings, ...candidate.settings },
    pages: candidate.pages ?? fallback.pages,
    pageBlocks: candidate.pageBlocks ?? fallback.pageBlocks,
    messageAutomations: candidate.messageAutomations ?? fallback.messageAutomations,
    messageLogs: candidate.messageLogs ?? fallback.messageLogs,
    customers: candidate.customers ?? fallback.customers,
    customerTasks: candidate.customerTasks ?? fallback.customerTasks,
    customerContacts: candidate.customerContacts ?? fallback.customerContacts,
    couponRedemptions: candidate.couponRedemptions ?? fallback.couponRedemptions,
    catalogImports: candidate.catalogImports ?? fallback.catalogImports,
    teamMembers: candidate.teamMembers ?? fallback.teamMembers,
    auditLogs: candidate.auditLogs ?? fallback.auditLogs,
    financialTransactions: candidate.financialTransactions ?? fallback.financialTransactions,
    inventoryMovements: candidate.inventoryMovements ?? fallback.inventoryMovements,
    productLots: candidate.productLots ?? fallback.productLots,
    suppliers: candidate.suppliers ?? fallback.suppliers,
    purchaseOrders: candidate.purchaseOrders ?? fallback.purchaseOrders,
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
  const demoDataKey = `${initialData.tenant.id}:store-data:v1`;
  const [data, setData] = useState(initialData);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initialData);

  useEffect(() => {
    if (demoMode) {
      try {
        const stored = window.localStorage.getItem(demoDataKey);
        if (stored) setData(normalizeData(JSON.parse(stored) as StoreData, initialRef.current));
      } catch {
        window.localStorage.removeItem(demoDataKey);
      }
    }
    setHydrated(true);
  }, [demoMode, demoDataKey]);

  useEffect(() => {
    if (demoMode && hydrated) {
      window.localStorage.setItem(demoDataKey, JSON.stringify(data));
    }
  }, [data, demoMode, hydrated, demoDataKey]);

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
    setData((current) => applyCreatedOrder(current, order));
  }, []);

  const resetData = useCallback(() => setData(structuredClone(initialRef.current)), []);
  const importData = useCallback((next: StoreData) => setData(normalizeData(next, initialRef.current)), []);

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
