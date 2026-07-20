"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { TurnstileWidget } from "@/components/security/turnstile-widget";
import { formatMoney } from "@/lib/format";
import { checkoutSchema, type CheckoutFormInput, type CheckoutInput } from "@/lib/validation";
import { checkoutWhatsappUrl } from "@/lib/whatsapp-order";
import { CHECKOUT_TERMS_VERSION, checkoutTerms } from "@/lib/checkout-terms";
import { withStorefrontPath } from "@/lib/storefront-path";
import { normalizePostalCode, type PostalCodeAddress } from "@/lib/postal-code";
import type { Order } from "@/types/store";

const states = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

type PersistedOrder = {
  id: string;
  customer_id?: string;
  code: string;
  created_at: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  cashback_total?: number;
  status: Order["status"];
  order_source?: Order["orderSource"];
  reservation_expires_at?: string;
};

export function CheckoutScreen() {
  const { data, addOrder, demoMode } = useStore();
  const { lines, coupon, calculate, clearCart } = useCart();
  const [submitError, setSubmitError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [postalCodeStatus, setPostalCodeStatus] = useState<"idle" | "loading" | "success" | "not-found" | "error">("idle");
  const handleTurnstileToken = useCallback((token: string) => setTurnstileToken(token), []);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormInput, unknown, CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { payment: "Pix", complement: "", consent: false, termsAccepted: false, botField: "", startedAt },
  });
  const payment = useWatch({ control, name: "payment" });
  const zip = useWatch({ control, name: "zip" });
  const calculation = calculate(payment);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const cartProducts = useMemo(
    () => lines.map((line) => ({ line, product: data.products.find((item) => item.id === line.productId) })).filter((entry) => entry.product),
    [data.products, lines],
  );

  useEffect(() => {
    const cep = normalizePostalCode(zip ?? "");
    if (cep.length !== 8) {
      setPostalCodeStatus("idle");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPostalCodeStatus("loading");
      try {
        const response = await fetch(`/api/storefront/postal-code?cep=${cep}`, { signal: controller.signal });
        const payload = await response.json().catch(() => null) as (PostalCodeAddress & { error?: string }) | null;
        if (response.status === 404) {
          setPostalCodeStatus("not-found");
          return;
        }
        if (!response.ok || !payload) throw new Error(payload?.error || "Postal code lookup failed");
        setValue("address", payload.address, { shouldDirty: true, shouldValidate: true });
        setValue("city", payload.city, { shouldDirty: true, shouldValidate: true });
        setValue("state", states.includes(payload.state) ? payload.state : "", { shouldDirty: true, shouldValidate: true });
        setPostalCodeStatus("success");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setPostalCodeStatus("error");
      }
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [setValue, zip]);

  async function submit(values: CheckoutInput) {
    setSubmitError("");
    const termsAcceptedAt = new Date().toISOString();
    const customer = {
      name: values.name,
      phone: values.phone,
      email: values.email,
      zip: values.zip,
      city: values.city,
      state: values.state,
      address: values.address,
      number: values.number,
      complement: values.complement,
      termsAcceptedAt,
      termsVersion: CHECKOUT_TERMS_VERSION,
    };
    const items = cartProducts.map(({ line, product }) => ({
      productId: product!.id,
      name: product!.name,
      quantity: line.quantity,
      unitPrice: product!.price,
      unitCost: 0,
      unitCashback: product!.cashback,
    }));
    const nextNumber = data.orders.reduce((max, order) => Math.max(max, Number(order.code.replace(/\D/g, "")) || 1000), 1000) + 1;
    let persisted: PersistedOrder | null = null;

    if (!demoMode) {
      const requestId = idempotencyKey || crypto.randomUUID();
      if (!idempotencyKey) setIdempotencyKey(requestId);
      const response = await fetch("/api/storefront/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: data.tenant.id,
          customer,
          items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
          payment: values.payment,
          termsAccepted: values.termsAccepted,
          couponCode: coupon?.code ?? "",
          idempotencyKey: requestId,
          botField: values.botField,
          startedAt: values.startedAt,
          turnstileToken,
        }),
      });
      const payload = await response.json().catch(() => null) as { order?: PersistedOrder; error?: string } | null;
      if (!response.ok || !payload?.order) {
        setSubmitError(payload?.error ?? "Não foi possível registrar o pedido.");
        return;
      }
      persisted = payload.order;
      setIdempotencyKey("");
    }

    const code = persisted?.code ?? `${data.settings.orderPrefix || "PED"}-${nextNumber}`;
    const order: Order = {
      id: persisted?.id ?? `order-${crypto.randomUUID()}`,
      customerId: persisted?.customer_id ?? "",
      code,
      createdAt: persisted?.created_at ?? new Date().toISOString(),
      customer,
      items,
      subtotal: persisted?.subtotal ?? calculation.subtotal,
      discount: persisted?.discount ?? calculation.discount,
      shipping: persisted?.shipping ?? calculation.shipping,
      total: persisted?.total ?? calculation.total,
      cashbackTotal: persisted?.cashback_total ?? calculation.cashback,
      payment: values.payment,
      status: persisted?.status ?? "Novo",
      couponCode: coupon?.code ?? "",
      internalNotes: "",
      trackingCode: "",
      orderSource: persisted?.order_source ?? "storefront",
      reservationExpiresAt: persisted?.reservation_expires_at ?? "",
    };
    addOrder(order);
    clearCart();
    window.location.assign(checkoutWhatsappUrl(order, data.settings));
  }

  if (!lines.length) {
    return <section className="page-state container"><span className="section-kicker">FINALIZAR PEDIDO</span><h1>Seu carrinho está vazio.</h1><p>Adicione ao menos um produto antes de continuar.</p><Link className="button button-primary" href={storeHref("/#catalogo")}>Ver produtos</Link></section>;
  }

  return (
    <section className="checkout-page container">
      <Link className="back-link" href={storeHref("/")}><ArrowLeft /> Continuar comprando</Link>
      <div className="checkout-page-heading"><span className="section-kicker">FINALIZAR COMPRA</span><h1>Revise e envie seu pedido.</h1><p>Ao finalizar, o pedido será registrado e o WhatsApp configurado pela loja abrirá com todos os dados para a equipe confirmar pagamento e envio.</p></div>
      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={handleSubmit(submit)} noValidate>
          <fieldset><legend>1. Dados pessoais</legend><div className="form-grid"><Field label="Nome completo" error={errors.name?.message}><input autoComplete="name" {...register("name")} /></Field><Field label="WhatsApp" error={errors.phone?.message}><input inputMode="tel" autoComplete="tel" {...register("phone")} /></Field><Field label="E-mail" error={errors.email?.message} full><input type="email" autoComplete="email" {...register("email")} /></Field></div></fieldset>
          <fieldset><legend>2. Entrega</legend><div className="form-grid"><Field label="CEP" error={errors.zip?.message}><input inputMode="numeric" autoComplete="postal-code" placeholder="00000-000" {...register("zip")} />{postalCodeStatus !== "idle" && <small className={`postal-code-status ${postalCodeStatus}`} role="status">{postalCodeStatus === "loading" ? "Buscando endereço..." : postalCodeStatus === "success" ? "Dados do CEP preenchidos." : postalCodeStatus === "not-found" ? "CEP não encontrado. Preencha o endereço manualmente." : "Não foi possível consultar agora. Preencha manualmente."}</small>}</Field><Field label="Cidade" error={errors.city?.message}><input autoComplete="address-level2" {...register("city")} /></Field><Field label="Estado" error={errors.state?.message}><select autoComplete="address-level1" {...register("state")}><option value="">Selecione</option>{states.map((state) => <option key={state}>{state}</option>)}</select></Field><Field label="Logradouro" error={errors.address?.message} full><input autoComplete="address-line1" {...register("address")} /></Field><Field label="Número" error={errors.number?.message}><input autoComplete="address-line2" {...register("number")} /></Field><Field label="Complemento" error={errors.complement?.message}><input autoComplete="address-line3" {...register("complement")} /></Field></div></fieldset>
          <fieldset><legend>3. Forma de pagamento preferida</legend><div className="payment-options">{(["Pix", "Cartao", "Dinheiro"] as const).map((method) => <label key={method}><input type="radio" value={method} {...register("payment")} /><span><strong>{method === "Cartao" ? "Cartão" : method}</strong><small>{method === "Pix" ? `${data.settings.pixDiscount}% de desconto` : method === "Cartao" ? "2x sem juros · confirmação no WhatsApp" : "Pagamento combinado no atendimento"}</small></span></label>)}</div></fieldset>
          <fieldset className="checkout-terms"><legend><AlertTriangle /> {checkoutTerms.title}</legend><div className="checkout-terms-content"><p className="terms-positive">✅ {checkoutTerms.videoRequirement}</p><p className="terms-negative">❌ {checkoutTerms.noVideoWarning}</p><p className="terms-positive">✅ {checkoutTerms.agreement}</p><p className="terms-positive">✅ {checkoutTerms.sellerResponsibility}</p><div className="terms-exclusions"><strong>❌ Não nos responsabilizamos por:</strong><ul>{checkoutTerms.exclusions.map((item) => <li key={item}>{item}</li>)}</ul></div></div><label className="terms-acceptance"><input type="checkbox" {...register("termsAccepted")} /><span><strong>Declaração:</strong> {checkoutTerms.declaration}</span></label>{errors.termsAccepted && <small className="field-error">{errors.termsAccepted.message}</small>}</fieldset>
          <label className="checkout-honeypot" aria-hidden="true">Não preencha<input tabIndex={-1} autoComplete="off" {...register("botField")} /></label>
          <input type="hidden" {...register("startedAt")} />
          <label className="consent-line"><input type="checkbox" {...register("consent")} /><span>Autorizo o envio dos dados deste pedido para o atendimento da loja pelo WhatsApp.</span></label>{errors.consent && <small className="field-error">{errors.consent.message}</small>}
          <TurnstileWidget onToken={handleTurnstileToken} />
          {submitError && <p className="field-error" role="alert">{submitError}</p>}
          <button className="button button-primary button-full button-large" type="submit" disabled={isSubmitting}><LockKeyhole /> {isSubmitting ? "Registrando pedido..." : "Finalizar pedido no WhatsApp"}</button>
        </form>
        <aside className="checkout-summary"><span>RESUMO DO PEDIDO</span>{cartProducts.map(({ line, product }) => <div className="summary-item" key={line.productId}><i>{data.settings.orderPrefix}</i><div><strong>{product!.name}</strong><small>{line.quantity} unidade{line.quantity > 1 ? "s" : ""}{product!.cashback > 0 ? ` · ${formatMoney(product!.cashback * line.quantity)} de cashback` : ""}</small></div><b>{formatMoney(product!.price * line.quantity)}</b></div>)}<div className="summary-totals"><div><span>Subtotal</span><strong>{formatMoney(calculation.subtotal)}</strong></div><div><span>Descontos</span><strong>- {formatMoney(calculation.discount)}</strong></div><div><span>Frete</span><strong>{calculation.shipping ? formatMoney(calculation.shipping) : "Grátis"}</strong></div><div className="grand-total"><span>Total do pedido</span><strong>{formatMoney(calculation.total)}</strong></div>{calculation.cashback > 0 && <div className="cashback-total"><span>Cashback previsto</span><strong>+ {formatMoney(calculation.cashback)}</strong></div>}</div><p className="summary-demo"><CheckCircle2 /> Pedido protegido e atendimento continuado pelo WhatsApp oficial da loja.</p></aside>
      </div>
    </section>
  );
}

function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return <label className={full ? "form-full" : ""}><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label>;
}
