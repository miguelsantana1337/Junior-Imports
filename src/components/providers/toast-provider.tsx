"use client";

import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
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

export type ToastKind = "success" | "error" | "info";
export type ToastInput = string | { message: string; kind?: ToastKind; duration?: number };

const ToastContext = createContext<((input: ToastInput) => void) | null>(null);

interface ToastRecord {
  id: number;
  message: string;
  kind: ToastKind;
  closing: boolean;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, { dismiss: number; remove?: number }>());

  const dismiss = useCallback((id: number) => {
    const currentTimers = timers.current.get(id);
    if (currentTimers?.remove) return;
    if (currentTimers?.dismiss) window.clearTimeout(currentTimers.dismiss);

    setToasts((current) => current.map((item) => item.id === id ? { ...item, closing: true } : item));
    const remove = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      timers.current.delete(id);
    }, 200);
    timers.current.set(id, { dismiss: currentTimers?.dismiss ?? 0, remove });
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const next = typeof input === "string" ? { message: input, kind: "success" as const, duration: 3200 } : input;
    const id = ++nextId.current;
    setToasts((current) => [...current, { id, message: next.message, kind: next.kind ?? "success", closing: false }]);
    const dismissTimer = window.setTimeout(() => dismiss(id), next.duration ?? 4200);
    timers.current.set(id, { dismiss: dismissTimer });
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach(({ dismiss: dismissTimer, remove }) => {
      window.clearTimeout(dismissTimer);
      if (remove) window.clearTimeout(remove);
    });
    timers.current.clear();
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="toast-viewport" aria-label="Notificações">
        {toasts.map((item) => {
          const Icon = item.kind === "success" ? CircleCheck : item.kind === "error" ? CircleAlert : Info;
          return (
            <div
              className={`toast ${item.kind} ${item.closing ? "closing" : ""}`}
              key={item.id}
              role={item.kind === "error" ? "alert" : "status"}
              aria-live={item.kind === "error" ? "assertive" : "polite"}
              aria-atomic="true"
            >
              <Icon className="toast-icon" aria-hidden="true" />
              <span>{item.message}</span>
              <button type="button" onClick={() => dismiss(item.id)} aria-label="Fechar notificação"><X /></button>
            </div>
          );
        })}
      </section>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
