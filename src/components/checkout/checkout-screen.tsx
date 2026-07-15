"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useCart } from "@/components/providers/cart-provider";
import { useStore } from "@/components/providers/store-provider";
import { formatMoney, whatsappUrl } from "@/lib/format";
import { validateCouponForCustomer } from "@/lib/coupon-rules";
import { createClient } from "@/lib/supabase/client";
import { checkoutSchema, type CheckoutInput } from "@/lib/validation";
import { renderWhatsappOrderMessage } from "@/lib/whatsapp-order";
import { withStorefrontPath } from "@/lib/storefront-path";
import type { Order } from "@/types/store";

const states = ["MG", "SP", "RJ", "ES", "BA", "PR", "SC", "RS", "GO", "DF", "Outro"];

type PersistedOrder = {
  id: string;
  customer_id?: string;
  code: string;
  created_at: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  status: Order["status"];
};

export function CheckoutScreen() {
  const { data, addOrder, demoMode } = useStore();
  const { lines, coupon, calculate, clearCart } = useCart();
  const router = useRouter();
  const [submitError, setSubmitError] = useState("");
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutInput>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { payment: "Pix", complement: "", consent: false },
  });
  const payment = useWatch({ control, name: "payment" });
  const calculation = calculate(payment);
  const storeHref = (href: string) => withStorefrontPath(data.tenant.storefrontPath, href);
  const cartProducts = useMemo(
    () => lines.map((line) => ({ line, product: data.products.find((item) => item.id === line.productId) })).filter((entry) => entry.product),
    [data.products, lines],
  );

  async function submit(values: CheckoutInput) {
    setSubmitError("");
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
    };
    const items = cartProducts.map(({ line, product }) => ({
      productId: product!.id,
      name: product!.name,
      quantity: line.quantity,
      unitPrice: product!.price,
    }));
    const nextNumber = data.orders.reduce((max, order) => Math.max(max, Number(order.code.replace(/\D/g, "")) || 1000), 1000) + 1;
    let persisted: PersistedOrder | null = null;

    if (demoMode && coupon) {
      const eligibility = validateCouponForCustomer(coupon, customer, data.orders, data.couponRedemptions);
      if (!eligibility.valid) {
        setSubmitError(eligibility.message);
        return;
      }
    }

    if (!demoMode) {
      const supabase = createClient();
      if (!supabase) {
        setSubmitError("Não foi possível conectar ao banco de dados.");
        return;
      }
      let result = await supabase.rpc("create_tenant_order", {
        p_tenant_id: data.tenant.id,
        p_customer: customer,
        p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
        p_payment: values.payment,
        p_coupon_code: coupon?.code ?? "",
      });
      if (result.error?.code === "PGRST202" || result.error?.code === "42883") {
        result = await supabase.rpc("create_demo_order", {
          p_customer: customer,
          p_items: items.map((item) => ({ product_id: item.productId, quantity: item.quantity })),
          p_payment: values.payment,
          p_coupon_code: coupon?.code ?? "",
        });
      }
      if (result.error || !result.data) {
        setSubmitError(result.error?.message ?? "Não foi possível registrar o pedido.");
        return;
      }
      persisted = result.data as PersistedOrder;
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
      payment: values.payment,
      status: persisted?.status ?? "Novo",
      couponCode: coupon?.code ?? "",
      internalNotes: "",
      trackingCode: "",
    };
    addOrder(order);
    clearCart();
    if (data.settings.checkoutMode === "whatsapp") {
      window.location.assign(whatsappUrl(data.settings.whatsapp, renderWhatsappOrderMessage(order, data.settings)));
      return;
    }
    router.push(storeHref(`/pedidos/${code}`));
  }

  if (!lines.length) {
    return <section className="page-state container"><span className="section-kicker">FINALIZAR PEDIDO</span><h1>Seu carrinho está vazio.</h1><p>Adicione ao menos um produto antes de continuar.</p><Link className="button button-primary" href={storeHref("/#catalogo")}>Ver produtos</Link></section>;
  }

  return (
    <section className="checkout-page container">
      <Link className="back-link" href={storeHref("/")}><ArrowLeft /> Continuar comprando</Link>
      <div className="checkout-page-heading"><span className="section-kicker">FINALIZAR PEDIDO</span><h1>Envie seu carrinho para a loja.</h1><p>{data.settings.checkoutMode === "whatsapp" ? "Ao finalizar, abriremos o WhatsApp com todos os dados do pedido." : "Nenhuma cobrança será realizada neste fluxo demonstrativo."}</p></div>
      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={handleSubmit(submit)} noValidate>
          <fieldset><legend>1. Dados pessoais</legend><div className="form-grid"><Field label="Nome completo" error={errors.name?.message}><input autoComplete="name" {...register("name")} /></Field><Field label="WhatsApp" error={errors.phone?.message}><input inputMode="tel" autoComplete="tel" {...register("phone")} /></Field><Field label="E-mail" error={errors.email?.message} full><input type="email" autoComplete="email" {...register("email")} /></Field></div></fieldset>
          <fieldset><legend>2. Entrega simulada</legend><div className="form-grid"><Field label="CEP" error={errors.zip?.message}><input inputMode="numeric" placeholder="00000-000" {...register("zip")} /></Field><Field label="Cidade" error={errors.city?.message}><input {...register("city")} /></Field><Field label="Estado" error={errors.state?.message}><select {...register("state")}><option value="">Selecione</option>{states.map((state) => <option key={state}>{state}</option>)}</select></Field><Field label="Endereço" error={errors.address?.message} full><input {...register("address")} /></Field><Field label="Número" error={errors.number?.message}><input {...register("number")} /></Field><Field label="Complemento" error={errors.complement?.message}><input {...register("complement")} /></Field></div></fieldset>
          <fieldset><legend>3. Pagamento simulado</legend><div className="payment-options">{(["Pix", "Cartao", "Boleto"] as const).map((method) => <label key={method}><input type="radio" value={method} {...register("payment")} /><span><strong>{method === "Cartao" ? "Cartão" : method}</strong><small>{method === "Pix" ? `${data.settings.pixDiscount}% de desconto demonstrativo` : method === "Cartao" ? "Até 6x sem juros" : "Vencimento em 1 dia útil"}</small></span></label>)}</div></fieldset>
          <label className="consent-line"><input type="checkbox" {...register("consent")} /><span>{data.settings.checkoutMode === "whatsapp" ? "Concordo em enviar estes dados para o atendimento da loja pelo WhatsApp." : "Concordo que esta é uma simulação e nenhum pagamento será realizado."}</span></label>{errors.consent && <small className="field-error">{errors.consent.message}</small>}
          {submitError && <p className="field-error" role="alert">{submitError}</p>}
          <button className="button button-primary button-full button-large" type="submit" disabled={isSubmitting}><LockKeyhole /> {data.settings.checkoutMode === "whatsapp" ? "Enviar pedido pelo WhatsApp" : "Criar pedido demonstrativo"}</button>
        </form>
        <aside className="checkout-summary"><span>RESUMO DO PEDIDO</span>{cartProducts.map(({ line, product }) => <div className="summary-item" key={line.productId}><i>{data.settings.orderPrefix}</i><div><strong>{product!.name}</strong><small>{line.quantity} unidade{line.quantity > 1 ? "s" : ""}</small></div><b>{formatMoney(product!.price * line.quantity)}</b></div>)}<div className="summary-totals"><div><span>Subtotal</span><strong>{formatMoney(calculation.subtotal)}</strong></div><div><span>Descontos</span><strong>- {formatMoney(calculation.discount)}</strong></div><div><span>Frete</span><strong>{calculation.shipping ? formatMoney(calculation.shipping) : "Grátis"}</strong></div><div className="grand-total"><span>Total</span><strong>{formatMoney(calculation.total)}</strong></div></div><p className="summary-demo"><CheckCircle2 /> {data.settings.checkoutMode === "whatsapp" ? "O valor final pode ser confirmado no atendimento." : "Valores apenas demonstrativos."}</p></aside>
      </div>
    </section>
  );
}

function Field({ label, error, full, children }: { label: string; error?: string; full?: boolean; children: React.ReactNode }) {
  return <label className={full ? "form-full" : ""}><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label>;
}
