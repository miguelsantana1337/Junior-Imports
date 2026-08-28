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
import {
  readSensitiveSessionValue,
  removeSensitiveBrowserValue,
  writeSensitiveSessionValue,
} from "@/lib/browser-storage";
import { canAddProductToCart } from "@/lib/product-compliance";
import {
  referralCodeFromSearch,
  referralStorageKey,
} from "@/lib/referral-link";
import type { CartLine, Coupon, PaymentMethod, ShippingDestination } from "@/types/store";
import type { FunnelStage } from "@/types/admin31";
import type { CartRecoveryContact } from "@/types/abandoned-cart";
import { useStore } from "./store-provider";

interface CartContextValue {
  lines: CartLine[];
  favorites: string[];
  coupon: Coupon | null;
  drawerOpen: boolean;
  ready: boolean;
  cartSessionId: string;
  itemCount: number;
  addItem: (productId: string, quantity?: number, components?: string[]) => void;
  updateItem: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  toggleFavorite: (productId: string) => void;
  applyCoupon: (code: string) => Promise<{ ok: boolean; message: string }>;
  trackCheckout: (input: { contactAllowed: boolean; customer?: CartRecoveryContact }) => void;
  trackEvent: (stage: FunnelStage, eventKey: string, properties?: Record<string, string | number | boolean | null>, productId?: string) => void;
  setDrawerOpen: (open: boolean) => void;
  calculate: (payment?: PaymentMethod, destination?: ShippingDestination) => ReturnType<typeof calculateCart>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { data, demoMode } = useStore();
  const cartKey = `${data.tenant.id}:cart:v1`;
  const favoritesKey = `${data.tenant.id}:favorites:v1`;
  const cartSessionKey = `${data.tenant.id}:cart-session:v1`;
  const referralKey = referralStorageKey(data.tenant.id);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cartSessionId, setCartSessionId] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [source, setSource] = useState<Record<string, string>>({});

  useEffect(() => {
    try {
      const storedLines = JSON.parse(readSensitiveSessionValue(cartKey) ?? "[]") as CartLine[];
      const storedFavorites = JSON.parse(readSensitiveSessionValue(favoritesKey) ?? "[]") as string[];
      const storedSessionId = readSensitiveSessionValue(cartSessionKey);
      setLines(storedLines);
      setFavorites(storedFavorites);
      setCartSessionId(storedSessionId && /^[0-9a-f-]{36}$/i.test(storedSessionId) ? storedSessionId : crypto.randomUUID());
    } catch {
      removeSensitiveBrowserValue(cartKey);
      removeSensitiveBrowserValue(favoritesKey);
    }
    setHydrated(true);
    const params = new URLSearchParams(window.location.search);
    const referralCode = referralCodeFromSearch(window.location.search);
    if (referralCode) writeSensitiveSessionValue(referralKey, referralCode);
    const nextSource = Object.fromEntries(["utm_source", "utm_medium", "utm_campaign", "utm_content", "ref"].flatMap((key) => {
      const value = params.get(key)?.trim();
      return value ? [[key, value]] : [];
    }));
    if (referralCode) nextSource.ref = referralCode;
    if (document.referrer) nextSource.referrer = document.referrer.slice(0, 500);
    setSource(nextSource);
  }, [cartKey, cartSessionKey, favoritesKey, referralKey]);

  useEffect(() => {
    if (hydrated) writeSensitiveSessionValue(cartKey, JSON.stringify(lines));
  }, [lines, hydrated, cartKey]);

  useEffect(() => {
    if (hydrated)
      writeSensitiveSessionValue(favoritesKey, JSON.stringify(favorites));
  }, [favorites, hydrated, favoritesKey]);

  useEffect(() => {
    if (hydrated && cartSessionId) writeSensitiveSessionValue(cartSessionKey, cartSessionId);
  }, [cartSessionId, cartSessionKey, hydrated]);

  const syncTrackedCart = useCallback(async (
    trackedSessionId: string,
    trackedLines: CartLine[],
    details?: { checkoutStarted?: boolean; contactAllowed?: boolean; customer?: CartRecoveryContact },
  ) => {
    if (demoMode || !trackedSessionId) return;
    await fetch("/api/storefront/carts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: data.tenant.id, sessionId: trackedSessionId, items: trackedLines, source, ...details }),
      keepalive: true,
    }).catch(() => undefined);
  }, [data.tenant.id, demoMode, source]);

  const trackEvent = useCallback((stage: FunnelStage, eventKey: string, properties: Record<string, string | number | boolean | null> = {}, productId?: string) => {
    if (demoMode || !cartSessionId) return;
    void fetch("/api/storefront/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId: data.tenant.id, sessionId: cartSessionId, eventKey, stage, productId, source, properties }),
      keepalive: true,
    }).catch(() => undefined);
  }, [cartSessionId, data.tenant.id, demoMode, source]);

  useEffect(() => {
    if (!hydrated || !cartSessionId) return;
    const timer = window.setTimeout(() => void syncTrackedCart(cartSessionId, lines), 900);
    return () => window.clearTimeout(timer);
  }, [cartSessionId, hydrated, lines, syncTrackedCart]);

  useEffect(() => {
    document.body.classList.toggle("locked", drawerOpen);
    return () => document.body.classList.remove("locked");
  }, [drawerOpen]);

  const addItem = useCallback(
    (productId: string, quantity = 1, components: string[] = []) => {
      const product = data.products.find((item) => item.id === productId);
      if (!product || !canAddProductToCart(product, data.settings.checkoutMode)) return;
      setCoupon(null);
      setLines((current) => {
        const existing = current.find((line) => line.productId === productId);
        if (existing) {
          return current.map((line) =>
            line.productId === productId
              ? components.length
                ? { ...line, quantity: Math.min(product.stock, Math.max(quantity, 1)), components }
                : { ...line, quantity: Math.min(product.stock, line.quantity + quantity) }
              : line,
          );
        }
        return [
          ...current,
          { productId, quantity: Math.min(product.stock, Math.max(quantity, 1)), components: components.length ? components : undefined },
        ];
      });
      trackEvent("added_to_cart", `added_to_cart:${productId}`, { quantity }, productId);
    },
    [data.products, data.settings.checkoutMode, trackEvent],
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
    void syncTrackedCart(cartSessionId, []);
    setLines([]);
    setCoupon(null);
    setCartSessionId(crypto.randomUUID());
  }, [cartSessionId, syncTrackedCart]);

  const trackCheckout = useCallback((input: { contactAllowed: boolean; customer?: CartRecoveryContact }) => {
    void syncTrackedCart(cartSessionId, lines, { checkoutStarted: true, ...input });
    trackEvent("checkout_started", "checkout_started", { items: lines.reduce((sum, line) => sum + line.quantity, 0) });
  }, [cartSessionId, lines, syncTrackedCart, trackEvent]);

  const toggleFavorite = useCallback((productId: string) => {
    setFavorites((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  const calculate = useCallback(
    (payment?: PaymentMethod, destination?: ShippingDestination) =>
      calculateCart(lines, data.products, data.settings, coupon, payment, data.cashbackCampaigns, destination),
    [lines, data.products, data.settings, coupon, data.cashbackCampaigns],
  );

  const applyCoupon = useCallback(
    async (code: string) => {
      const normalized = code.trim().toUpperCase();
      if (!normalized || !lines.length) {
        setCoupon(null);
        return { ok: false, message: "Informe um cupom e adicione produtos ao carrinho." };
      }
      const currentCalculation = calculateCart(lines, data.products, data.settings, null, undefined, data.cashbackCampaigns);
      if (currentCalculation.promotionApplied && !data.settings.quantityPromotion.allowCoupons) {
        setCoupon(null);
        return { ok: false, message: "Esta promoção acumula cashback, mas não aceita cupom ou outro desconto." };
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
        applicableCategoryIds: [],
        applicableProductIds: [],
        firstOrderOnly: false,
        usageCount: 0,
      });
      return { ok: true, message: `Cupom ${payload.code} aplicado.` };
    },
    [data.cashbackCampaigns, data.products, data.settings, data.tenant.id, lines],
  );

  const value = useMemo(
    () => ({
      lines,
      favorites,
      coupon,
      drawerOpen,
      ready: hydrated,
      cartSessionId,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      addItem,
      updateItem,
      removeItem,
      clearCart,
      toggleFavorite,
      applyCoupon,
      trackCheckout,
      trackEvent,
      setDrawerOpen,
      calculate,
    }),
    [
      lines,
      favorites,
      coupon,
      drawerOpen,
      hydrated,
      cartSessionId,
      addItem,
      updateItem,
      removeItem,
      clearCart,
      toggleFavorite,
      applyCoupon,
      trackCheckout,
      trackEvent,
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
