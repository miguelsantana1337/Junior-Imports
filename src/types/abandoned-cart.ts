export type TrackedCartStatus = "active" | "abandoned" | "recovered" | "dismissed";

export interface TrackedCartItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface TrackedCart {
  id: string;
  sessionId: string;
  status: TrackedCartStatus;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  contactAllowed: boolean;
  items: TrackedCartItem[];
  itemCount: number;
  subtotal: number;
  checkoutStartedAt: string;
  lastActivityAt: string;
  recoveredAt: string;
  recoveredOrderId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartRecoveryContact {
  name: string;
  phone: string;
  email: string;
}
