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
import type { CartLine, Coupon, PaymentMethod } from "@/types/store";
import { useStore } from "./store-provider";

const CART_KEY = "juniorImportsNextCart";
const FAVORITES_KEY = "juniorImportsNextFavorites";

interface CartContextValue {
  lines: CartLine[];
  favorites: string[];
  coupon: Coupon | null;
  drawerOpen: boolean;
  itemCount: number;
  addItem: (productId: string, quantity?: number) => void;
  updateItem: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  applyCoupon: (code: string) => { ok: boolean; message: string };
  setDrawerOpen: (open: boolean) => void;
  calculate: (payment?: PaymentMethod) => ReturnType<typeof calculateCart>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { data } = useStore();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setLines(JSON.parse(window.localStorage.getItem(CART_KEY) ?? "[]"));
      setFavorites(JSON.parse(window.localStorage.getItem(FAVORITES_KEY) ?? "[]"));
    } catch {
      window.localStorage.removeItem(CART_KEY);
      window.localStorage.removeItem(FAVORITES_KEY);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(CART_KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  useEffect(() => {
    if (hydrated)
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  }, [favorites, hydrated]);

  useEffect(() => {
    document.body.classList.toggle("locked", drawerOpen);
    return () => document.body.classList.remove("locked");
  }, [drawerOpen]);

  const addItem = useCallback(
    (productId: string, quantity = 1) => {
      const product = data.products.find((item) => item.id === productId);
      if (!product || !product.active || product.stock <= 0) return;
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
    [data.products],
  );

  const updateItem = useCallback(
    (productId: string, quantity: number) => {
      const product = data.products.find((item) => item.id === productId);
      if (!product) return;
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
    [data.products],
  );

  const removeItem = useCallback(
    (productId: string) =>
      setLines((current) => current.filter((line) => line.productId !== productId)),
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
    (code: string) => {
      const normalized = code.trim().toUpperCase();
      const found = data.coupons.find((item) => item.code.toUpperCase() === normalized);
      const result = calculateCart(lines, data.products, data.settings, found ?? null);
      if (!found || result.couponDiscount <= 0) {
        setCoupon(null);
        return { ok: false, message: "Cupom inválido, expirado ou abaixo do valor mínimo." };
      }
      setCoupon(found);
      return { ok: true, message: `Cupom ${found.code} aplicado.` };
    },
    [data.coupons, data.products, data.settings, lines],
  );

  const value = useMemo(
    () => ({
      lines,
      favorites,
      coupon,
      drawerOpen,
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
