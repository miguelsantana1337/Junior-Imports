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
import type { Order, StorefrontData } from "@/types/store";
import { sanitizeProductForStorefront } from "@/lib/storefront-product";

interface StoreContextValue {
  data: StorefrontData;
  demoMode: boolean;
  setData: React.Dispatch<React.SetStateAction<StorefrontData>>;
  addOrder: (order: Order) => void;
  resetData: () => void;
  importData: (data: StorefrontData) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

function normalizeData(candidate: StorefrontData, fallback: StorefrontData): StorefrontData {
  return {
    tenant: { ...fallback.tenant, ...candidate.tenant },
    settings: { ...fallback.settings, ...candidate.settings },
    products: (candidate.products ?? fallback.products).map((product) => sanitizeProductForStorefront(product, product.stock, false)),
    categories: candidate.categories ?? fallback.categories,
    banners: candidate.banners ?? fallback.banners,
    sections: candidate.sections ?? fallback.sections,
    pages: candidate.pages ?? fallback.pages,
    pageBlocks: candidate.pageBlocks ?? fallback.pageBlocks,
    trustItems: candidate.trustItems ?? fallback.trustItems,
    benefits: candidate.benefits ?? fallback.benefits,
    faqs: candidate.faqs ?? fallback.faqs,
    orders: candidate.orders ?? fallback.orders,
  };
}

export function StoreProvider({
  initialData,
  children,
}: {
  initialData: StorefrontData;
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
        if (stored) setData(normalizeData(JSON.parse(stored) as StorefrontData, initialRef.current));
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
    setData((current) => ({ ...current, orders: [order, ...current.orders.filter((item) => item.id !== order.id)] }));
  }, []);

  const resetData = useCallback(() => setData(structuredClone(initialRef.current)), []);
  const importData = useCallback((next: StorefrontData) => setData(normalizeData(next, initialRef.current)), []);

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
