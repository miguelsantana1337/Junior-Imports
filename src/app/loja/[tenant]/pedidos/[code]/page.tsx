import { OrderSuccess } from "@/components/checkout/order-success";

export default async function TenantOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <OrderSuccess code={decodeURIComponent(code)} />;
}
