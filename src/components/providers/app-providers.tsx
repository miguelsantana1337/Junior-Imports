"use client";

import type { ReactNode } from "react";
import type { StorefrontData } from "@/types/store";
import { StoreProvider } from "./store-provider";
import { CartProvider } from "./cart-provider";
import { ToastProvider } from "./toast-provider";
import { ConfirmProvider } from "./confirm-provider";

export function AppProviders({
  initialData,
  children,
}: {
  initialData: StorefrontData;
  children: ReactNode;
}) {
  return (
    <StoreProvider initialData={initialData}>
      <ToastProvider>
        <ConfirmProvider>
          <CartProvider>{children}</CartProvider>
        </ConfirmProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
