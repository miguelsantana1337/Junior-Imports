"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFunction = (options: ConfirmOptions) => Promise<boolean>;

interface PendingConfirmation extends ConfirmOptions {
  resolve: (confirmed: boolean) => void;
}

const ConfirmContext = createContext<ConfirmFunction | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback<ConfirmFunction>((options) => new Promise((resolve) => {
    setPending({ ...options, resolve });
  }), []);

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    confirmButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus.current?.focus();
    };
  }, [close, pending]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="admin-modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-description">
          <button className="admin-modal-overlay" onClick={() => close(false)} aria-label="Cancelar" />
          <div className="admin-modal-panel small">
            <div className="confirm-dialog-content">
              <h2 id="confirm-title">{pending.title}</h2>
              <p id="confirm-description">{pending.description}</p>
              <div className="admin-form-actions">
                <button type="button" className="admin-button" onClick={() => close(false)}>
                  {pending.cancelLabel ?? "Cancelar"}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  className={`admin-button ${pending.danger ? "confirm-danger" : "primary"}`}
                  onClick={() => close(true)}
                >
                  {pending.confirmLabel ?? "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error("useConfirm must be used inside ConfirmProvider");
  return context;
}
