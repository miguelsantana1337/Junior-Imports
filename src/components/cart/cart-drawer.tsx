"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { formatMoney } from "@/lib/format";
import { withStorefrontPath } from "@/lib/storefront-path";

export function CartDrawer() {
  const { data } = useStore();
  const {
    lines,
    drawerOpen,
    setDrawerOpen,
    updateItem,
    removeItem,
    clearCart,
    applyCoupon,
    calculate,
  } = useCart();
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [couponApplying, setCouponApplying] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const calculation = calculate();

  useEffect(() => {
    if (!drawerOpen) return;

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [drawerOpen, setDrawerOpen]);

  return (
    <aside
      className={`drawer ${drawerOpen ? "open" : ""}`}
      aria-hidden={!drawerOpen}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cart-title"
    >
      <button className="drawer-overlay" onClick={() => setDrawerOpen(false)} aria-label="Fechar carrinho" />
      <div className="drawer-panel" ref={panelRef}>
        <header>
          <div><span>SEU PEDIDO</span><h2 id="cart-title">Carrinho</h2></div>
          <button ref={closeButtonRef} className="close-button" onClick={() => setDrawerOpen(false)} aria-label="Fechar carrinho"><X /></button>
        </header>
        <div className="drawer-content">
          {lines.length === 0 ? (
            <div className="cart-empty">
              <ShoppingCart />
              <strong>Seu carrinho está vazio.</strong>
              <p>Adicione produtos para continuar.</p>
            </div>
          ) : (
            lines.map((line) => {
              const product = data.products.find((item) => item.id === line.productId);
              if (!product) return null;
              return (
                <article className="cart-item" key={line.productId}>
                  <div className="cart-thumb">{data.settings.orderPrefix}</div>
                  <div>
                    <h3>{product.name}</h3>
                    <strong>{formatMoney(product.price * line.quantity)}</strong>
                    {product.cashback > 0 && <small className="cart-item-cashback">+ {formatMoney(product.cashback * line.quantity)} de cashback</small>}
                    <div className="quantity-control">
                      <button onClick={() => updateItem(product.id, line.quantity - 1)} aria-label={`Diminuir ${product.name}`}><Minus /></button>
                      <span>{line.quantity}</span>
                      <button onClick={() => updateItem(product.id, line.quantity + 1)} aria-label={`Aumentar ${product.name}`}><Plus /></button>
                    </div>
                  </div>
                  <button className="remove-button" onClick={() => removeItem(product.id)} aria-label={`Remover ${product.name}`}><Trash2 /></button>
                </article>
              );
            })
          )}
        </div>
        <div className="drawer-footer">
          <form
            className="coupon-box"
            onSubmit={async (event) => {
              event.preventDefault();
              setCouponApplying(true);
              try {
                const result = await applyCoupon(couponCode);
                setCouponMessage({ ok: result.ok, text: result.message });
              } finally {
                setCouponApplying(false);
              }
            }}
          >
            <label htmlFor="cart-coupon">Cupom de desconto</label>
            <div><input id="cart-coupon" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Digite o código" /><button type="submit" disabled={couponApplying}>{couponApplying ? "Validando..." : "Aplicar"}</button></div>
            <small className={couponMessage?.ok ? "success-text" : "error-text"}>{couponMessage?.text}</small>
          </form>
          <div className="total-line"><span>Subtotal</span><strong>{formatMoney(calculation.subtotal)}</strong></div>
          {calculation.discount > 0 && <div className="total-line"><span>Desconto</span><strong>- {formatMoney(calculation.discount)}</strong></div>}
          <div className="total-line"><span>{data.settings.checkoutMode === "whatsapp" ? "Frete estimado" : "Frete demonstrativo"}</span><strong>{calculation.shipping ? formatMoney(calculation.shipping) : "Grátis"}</strong></div>
          <div className="total-line grand-total"><span>Total</span><strong>{formatMoney(calculation.total)}</strong></div>
          {calculation.cashback > 0 && <div className="total-line cart-cashback-total"><span>Cashback previsto</span><strong>+ {formatMoney(calculation.cashback)}</strong></div>}
          <Link className={`button button-primary button-full button-large ${lines.length ? "" : "disabled"}`} href={lines.length ? withStorefrontPath(data.tenant.storefrontPath, "/checkout") : "#"} onClick={() => lines.length && setDrawerOpen(false)}>Ir para o checkout</Link>
          <button className="text-button" onClick={clearCart} disabled={!lines.length}>Esvaziar carrinho</button>
        </div>
      </div>
    </aside>
  );
}
