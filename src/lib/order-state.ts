import { normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/crm";
import { createMessageLogs } from "@/lib/message-automation";
import type {
  Customer,
  CustomerSource,
  MessageLog,
  Order,
  StoreData,
} from "@/types/store";

type ApplyCreatedOrderOptions = {
  actorEmail?: string;
  customerSource?: CustomerSource;
  generatedLogs?: MessageLog[];
};

export function applyCreatedOrder(
  current: StoreData,
  order: Order,
  options: ApplyCreatedOrderOptions = {},
): StoreData {
  const email = normalizeCustomerEmail(order.customer.email);
  const phone = normalizeCustomerPhone(order.customer.phone);
  const existingCustomer = current.customers.find((customer) => (
    (order.customerId && customer.id === order.customerId)
    || (email && normalizeCustomerEmail(customer.email) === email)
    || (phone && normalizeCustomerPhone(customer.phone) === phone)
  ));
  const now = order.createdAt || new Date().toISOString();
  const customerId = order.customerId || existingCustomer?.id || `customer-${crypto.randomUUID()}`;
  const storedOrder = { ...order, customerId };
  const customer: Customer = existingCustomer
    ? {
        ...existingCustomer,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        city: order.customer.city,
        state: order.customer.state,
        updatedAt: now,
      }
    : {
        id: customerId,
        name: order.customer.name,
        email: order.customer.email,
        phone: order.customer.phone,
        city: order.customer.city,
        state: order.customer.state,
        source: options.customerSource ?? "whatsapp",
        tags: [],
        notes: "",
        assignedTo: "",
        whatsappConsent: true,
        emailConsent: false,
        createdAt: now,
        updatedAt: now,
      };
  const customers = existingCustomer
    ? current.customers.map((item) => item.id === existingCustomer.id ? customer : item)
    : [customer, ...current.customers];
  const coupon = current.coupons.find((item) => item.code.toUpperCase() === order.couponCode.toUpperCase());
  let couponRedemptions = current.couponRedemptions;

  if (coupon && !couponRedemptions.some((item) => item.orderId === order.id)) {
    const couponDiscount = Math.min(
      order.subtotal,
      coupon.type === "percent" ? order.subtotal * coupon.value / 100 : coupon.value,
    );
    couponRedemptions = [{
      id: `redemption-${crypto.randomUUID()}`,
      couponId: coupon.id,
      couponCode: coupon.code,
      customerId,
      orderId: order.id,
      normalizedEmail: email,
      normalizedPhone: phone,
      discount: couponDiscount,
      status: order.status === "Cancelado" ? "released" : "used",
      usedAt: now,
    }, ...couponRedemptions];
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
      actorEmail: options.actorEmail ?? "",
      createdAt: now,
    };
  });
  const generatedLogs = options.generatedLogs ?? createMessageLogs(storedOrder, current.messageAutomations ?? []);

  return {
    ...current,
    products,
    customers,
    couponRedemptions,
    inventoryMovements: [...inventoryMovements, ...current.inventoryMovements],
    orders: [storedOrder, ...current.orders],
    messageLogs: [...generatedLogs, ...(current.messageLogs ?? [])],
  };
}
