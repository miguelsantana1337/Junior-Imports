import { describe, expect, it } from "vitest";
import { cloneSeedData } from "@/data/seed";
import { applyCreatedOrder } from "./order-state";
import type { Order } from "@/types/store";

describe("reserva de estoque ao criar pedido", () => {
  it("registra o pedido sem baixar fisicamente o saldo antes da confirmação", () => {
    const data = cloneSeedData();
    const product = data.products.find((item) => item.stock > 0)!;
    const initialStock = product.stock;
    const order: Order = {
      id: "order-reserved",
      customerId: "",
      code: "JI-TEST",
      createdAt: new Date().toISOString(),
      customer: {
        name: "Cliente Teste",
        phone: "(31) 99999-9999",
        email: "cliente@example.com",
        zip: "35160-000",
        city: "Ipatinga",
        state: "MG",
        address: "Rua Teste",
        number: "10",
        complement: "",
      },
      items: [{
        productId: product.id,
        name: product.name,
        quantity: 1,
        unitPrice: product.price,
        unitCost: product.costPrice,
      }],
      subtotal: product.price,
      discount: 0,
      shipping: 0,
      total: product.price,
      payment: "Pix",
      status: "Novo",
      couponCode: "",
      internalNotes: "",
      trackingCode: "",
      orderSource: "storefront",
      reservationExpiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    };

    const result = applyCreatedOrder(data, order);

    expect(result.orders[0].id).toBe(order.id);
    expect(result.products.find((item) => item.id === product.id)?.stock).toBe(initialStock);
  });
});
