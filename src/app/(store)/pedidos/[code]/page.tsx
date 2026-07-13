import { OrderSuccess } from "@/components/checkout/order-success";

export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <OrderSuccess code={code} />;
}
