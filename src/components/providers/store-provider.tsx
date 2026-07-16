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
import type { CouponRedemption, Customer, Order, StoreData } from "@/types/store";
import { createMessageLogs } from "@/lib/message-automation";
import { normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/crm";

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
    setData((current) => {
      const email = normalizeCustomerEmail(order.customer.email);
      const phone = normalizeCustomerPhone(order.customer.phone);
      const existingCustomer = current.customers.find((customer) => (
        (email && normalizeCustomerEmail(customer.email) === email)
        || (phone && normalizeCustomerPhone(customer.phone) === phone)
      ));
      const now = order.createdAt || new Date().toISOString();
      const customerId = order.customerId || existingCustomer?.id || `customer-${crypto.randomUUID()}`;
      const storedOrder = { ...order, customerId };
      const customer: Customer = existingCustomer
        ? { ...existingCustomer, name: order.customer.name, email: order.customer.email, phone: order.customer.phone, city: order.customer.city, state: order.customer.state, updatedAt: now }
        : { id: customerId, name: order.customer.name, email: order.customer.email, phone: order.customer.phone, city: order.customer.city, state: order.customer.state, source: "whatsapp", tags: [], notes: "", assignedTo: "", whatsappConsent: true, emailConsent: false, createdAt: now, updatedAt: now };
      const customers = existingCustomer
        ? current.customers.map((item) => item.id === existingCustomer.id ? customer : item)
        : [customer, ...current.customers];
      const coupon = current.coupons.find((item) => item.code.toUpperCase() === order.couponCode.toUpperCase());
      let couponRedemptions = current.couponRedemptions;
      if (coupon && !couponRedemptions.some((item) => item.orderId === order.id)) {
        const couponDiscount = Math.min(order.subtotal, coupon.type === "percent" ? order.subtotal * coupon.value / 100 : coupon.value);
        const redemption: CouponRedemption = { id: `redemption-${crypto.randomUUID()}`, couponId: coupon.id, couponCode: coupon.code, customerId, orderId: order.id, normalizedEmail: email, normalizedPhone: phone, discount: couponDiscount, status: order.status === "Cancelado" ? "released" : "used", usedAt: now };
        couponRedemptions = [redemption, ...couponRedemptions];
      }
      const products = current.products.map((product) => {
        const item = storedOrder.items.find((candidate) => candidate.productId === product.id);
        return item ? { ...product, stock: Math.max(0, product.stock - item.quantity) } : product;
      });
      const inventoryMovements = storedOrder.items.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        return {
          id: `sale-${storedOrder.id}-${item.productId}`,
          productId: item.productId,
          type: "sale" as const,
          quantity: -item.quantity,
          balanceAfter: product?.stock ?? 0,
          unitCost: item.unitCost,
          referenceType: "order",
          referenceId: storedOrder.id,
          note: `Reserva automática do pedido ${storedOrder.code}.`,
          actorEmail: "",
          createdAt: now,
        };
      });
      return {
        ...current,
        products,
        customers,
        couponRedemptions,
        inventoryMovements: [...inventoryMovements, ...current.inventoryMovements],
        orders: [storedOrder, ...current.orders],
        messageLogs: [
          ...createMessageLogs(storedOrder, current.messageAutomations ?? []),
          ...(current.messageLogs ?? []),
        ],
      };
    });
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
