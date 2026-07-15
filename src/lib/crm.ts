import type { Customer, CustomerInsight, CustomerSegment, Order } from "@/types/store";

const DAY = 86_400_000;

export function normalizeCustomerEmail(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export function normalizeCustomerPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function customerMatchesOrder(customer: Pick<Customer, "id" | "email" | "phone">, order: Order) {
  if (order.customerId && order.customerId === customer.id) return true;
  const email = normalizeCustomerEmail(order.customer.email);
  const phone = normalizeCustomerPhone(order.customer.phone);
  return Boolean(
    (email && email === normalizeCustomerEmail(customer.email))
    || (phone && phone === normalizeCustomerPhone(customer.phone)),
  );
}

function segmentFor(orderCount: number, totalSpent: number, daysSinceLast: number, averageInterval: number, firstOrderAt: string, now: Date): CustomerSegment {
  if (orderCount >= 5 || totalSpent >= 2500) return "vip";
  if (daysSinceLast > 120) return "inactive";
  if (orderCount >= 2 && daysSinceLast > Math.max(45, Math.round(averageInterval * 1.5))) return "at_risk";
  if (orderCount >= 2) return "recurring";
  if (firstOrderAt && (now.getTime() - new Date(firstOrderAt).getTime()) / DAY <= 30) return "new";
  return "active";
}

function derivedCustomer(order: Order): Customer {
  const key = normalizeCustomerEmail(order.customer.email) || normalizeCustomerPhone(order.customer.phone) || order.id;
  return {
    id: `derived-${key.replace(/[^a-z0-9]/gi, "-")}`,
    name: order.customer.name,
    email: order.customer.email,
    phone: order.customer.phone,
    city: order.customer.city,
    state: order.customer.state,
    source: "other",
    tags: [],
    notes: "",
    createdAt: order.createdAt,
    updatedAt: order.createdAt,
  };
}

export function buildCustomerInsights(customers: Customer[], orders: Order[], now = new Date()): CustomerInsight[] {
  const allCustomers = [...customers];
  for (const order of orders) {
    if (!allCustomers.some((customer) => customerMatchesOrder(customer, order))) allCustomers.push(derivedCustomer(order));
  }

  return allCustomers.map((customer) => {
    const customerOrders = orders
      .filter((order) => order.status !== "Cancelado" && customerMatchesOrder(customer, order))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const orderCount = customerOrders.length;
    const totalSpent = customerOrders.reduce((sum, order) => sum + order.total, 0);
    const firstOrderAt = customerOrders[0]?.createdAt ?? "";
    const lastOrderAt = customerOrders.at(-1)?.createdAt ?? "";
    const intervals = customerOrders.slice(1).map((order, index) => (
      new Date(order.createdAt).getTime() - new Date(customerOrders[index].createdAt).getTime()
    ) / DAY);
    const averageDaysBetweenOrders = intervals.length
      ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length)
      : 0;
    const daysSinceLastOrder = lastOrderAt ? Math.max(0, Math.floor((now.getTime() - new Date(lastOrderAt).getTime()) / DAY)) : 0;
    const productCounts = new Map<string, number>();
    customerOrders.forEach((order) => order.items.forEach((item) => productCounts.set(item.name, (productCounts.get(item.name) ?? 0) + item.quantity)));
    const favoriteProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);
    const predictedNextOrderAt = lastOrderAt && averageDaysBetweenOrders
      ? new Date(new Date(lastOrderAt).getTime() + averageDaysBetweenOrders * DAY).toISOString()
      : "";

    return {
      ...customer,
      orderCount,
      totalSpent,
      averageTicket: orderCount ? totalSpent / orderCount : 0,
      firstOrderAt,
      lastOrderAt,
      averageDaysBetweenOrders,
      daysSinceLastOrder,
      predictedNextOrderAt,
      favoriteProducts,
      segment: segmentFor(orderCount, totalSpent, daysSinceLastOrder, averageDaysBetweenOrders, firstOrderAt, now),
    };
  }).sort((a, b) => b.totalSpent - a.totalSpent || b.orderCount - a.orderCount);
}

export function customerRecurrenceRate(insights: CustomerInsight[]) {
  const buyers = insights.filter((customer) => customer.orderCount > 0);
  if (!buyers.length) return 0;
  return (buyers.filter((customer) => customer.orderCount > 1).length / buyers.length) * 100;
}
