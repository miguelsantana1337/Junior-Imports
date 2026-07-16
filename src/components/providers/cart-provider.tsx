"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { calculateCart } from "@/lib/commerce";
import { canAddProductToCart } from "@/lib/product-compliance";
import type { CartLine, Coupon, PaymentMethod } from "@/types/store";
import { useStore } from "./store-provider";

interface CartContextValue {
  lines: CartLine[];
  favorites: string[];
  coupon: Coupon | null;
  drawerOpen: boolean;
  ready: boolean;
  itemCount: number;
  addItem: (productId: string, quantity?: number) => void;
  updateItem: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  setDrawerOpen: (open: boolean) => void;
  calculate: (payment?: PaymentMethod) => ReturnType<typeof calculateCart>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { data } = useStore();
  const cartKey = `${data.tenant.id}:cart:v1`;
  const favoritesKey = `${data.tenant.id}:favorites:v1`;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedLines = JSON.parse(window.localStorage.getItem(cartKey) ?? "[]") as CartLine[];
      const storedFavorites = JSON.parse(window.localStorage.getItem(favoritesKey) ?? "[]") as string[];
      setLines(storedLines);
      setFavorites(storedFavorites);
    } catch {
      window.localStorage.removeItem(cartKey);
      window.localStorage.removeItem(favoritesKey);
    }
    setHydrated(true);
  }, [cartKey, favoritesKey]);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(cartKey, JSON.stringify(lines));
  }, [lines, hydrated, cartKey]);

  useEffect(() => {
    if (hydrated)
      window.localStorage.setItem(favoritesKey, JSON.stringify(favorites));
  }, [favorites, hydrated, favoritesKey]);

  useEffect(() => {
    document.body.classList.toggle("locked", drawerOpen);
    return () => document.body.classList.remove("locked");
  }, [drawerOpen]);

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const product = data.products.find((item) => item.id === productId);
      if (!product || !canAddProductToCart(product, data.settings.checkoutMode)) return;
      setCoupon(null);
      setLines((current) => {
        const existing = current.find((line) => line.productId === productId);
        if (existing) {
          return current.map((line) =>
            line.productId === productId
              ? { ...line, quantity: Math.min(product.stock, line.quantity + quantity) }
              : line,
          );
        }
        return [
          ...current,
          { productId, quantity: Math.min(product.stock, Math.max(quantity, 1)) },
        ];
      });
    },
    [data.products, data.settings.checkoutMode],
  );

  const updateItem = useCallback(
    (productId: string, quantity: number) => {
      const product = data.products.find((item) => item.id === productId);
      setCoupon(null);
      if (!product || !canAddProductToCart(product, data.settings.checkoutMode)) {
        setLines((current) => current.filter((line) => line.productId !== productId));
        return;
      }
      setLines((current) =>
        quantity <= 0
          ? current.filter((line) => line.productId !== productId)
          : current.map((line) =>
              line.productId === productId
                ? { ...line, quantity: Math.min(product.stock, quantity) }
                : line,
            ),
      );
    },
    [data.products, data.settings.checkoutMode],
  );

  const removeItem = useCallback(
    (productId: string) => {
      setCoupon(null);
      setLines((current) => current.filter((line) => line.productId !== productId));
    },
    [],
  );

  const clearCart = useCallback(() => {
    setLines([]);
    setCoupon(null);
  }, []);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  const calculate = useCallback(
    (payment?: PaymentMethod) =>
      calculateCart(lines, data.products, data.settings, coupon, payment),
    [lines, data.products, data.settings, coupon],
  );

  const applyCoupon = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized || !lines.length) {
        setCoupon(null);
        return { ok: false, message: "Informe um cupom e adicione produtos ao carrinho." };
      }
      const response = await fetch("/api/storefront/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: data.tenant.id,
          code: normalized,
          items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity })),
        }),
      });
      const payload = await response.json().catch(() => null) as { valid?: boolean; code?: string; discount?: number; message?: string; error?: string } | null;
      if (!response.ok || !payload?.valid || !payload.code || !payload.discount) {
        setCoupon(null);
        return { ok: false, message: payload?.message || payload?.error || "Cupom inválido ou expirado." };
      }
      setCoupon({
        id: `applied-${payload.code}`,
        code: payload.code,
        type: "fixed",
        value: payload.discount,
        minimum: 0,
        active: true,
        startsAt: "",
        expiresAt: "",
        totalUsageLimit: 0,
        perCustomerLimit: 0,
        firstOrderOnly: false,
        usageCount: 0,
      });
      return { ok: true, message: `Cupom ${payload.code} aplicado.` };
    },
    [data.tenant.id, lines],
  );

  const value = useMemo(
    () => ({
      lines,
      favorites,
      coupon,
      drawerOpen,
      ready: hydrated,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      addItem,
      updateItem,
      removeItem,
      clearCart,
      toggleFavorite,
      applyCoupon,
      setDrawerOpen,
      calculate,
    }),
    [
      lines,
      favorites,
      coupon,
      drawerOpen,
      hydrated,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      toggleFavorite,
      applyCoupon,
      calculate,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
