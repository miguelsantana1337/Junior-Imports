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

export type ToastKind = "success" | "error" | "info";
export type ToastInput = string | { message: string; kind?: ToastKind; duration?: number };

const ToastContext = createContext<((input: ToastInput) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const [kind, setKind] = useState<ToastKind>("success");
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  const toast = useCallback((input: ToastInput) => {
    const next = typeof input === "string" ? { message: input, kind: "success" as const, duration: 3200 } : input;
    if (timer.current) window.clearTimeout(timer.current);
    setMessage(next.message);
    setKind(next.kind ?? "success");
    setVisible(true);
    timer.current = window.setTimeout(() => setVisible(false), next.duration ?? 4200);
  }, []);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className={`toast ${kind} ${visible ? "show" : ""}`}
        role={kind === "error" ? "alert" : "status"}
        aria-live={kind === "error" ? "assertive" : "polite"}
      >
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
