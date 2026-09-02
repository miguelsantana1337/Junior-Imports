"use client";

import { useEffect, type ReactNode } from "react";
import type { StorefrontData } from "@/types/store";
import type { StorefrontCatalogScope } from "@/lib/storefront-catalog-scope";
import { purgeLegacyAuthLocalStorage } from "@/lib/browser-storage";
import { StoreProvider } from "./store-provider";
import { CartProvider } from "./cart-provider";
import { ToastProvider } from "./toast-provider";
import { ConfirmProvider } from "./confirm-provider";

export function AppProviders({
  initialData,
  storefrontScope = "all",
  children,
}: {
  initialData: StorefrontData;
  storefrontScope?: StorefrontCatalogScope;
  children: ReactNode;
}) {
  useEffect(() => {
    purgeLegacyAuthLocalStorage();
  }, []);

  return (
    <StoreProvider initialData={initialData} storefrontScope={storefrontScope}>
      <ToastProvider>
        <ConfirmProvider>
          <CartProvider>{children}</CartProvider>
        </ConfirmProvider>
      </ToastProvider>
    </StoreProvider>
  );
}
