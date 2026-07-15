import { ProductEditorPage } from "@/components/admin/product-editor-page";
import { requireAdmin } from "@/lib/require-admin";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("catalog");
  const { id } = await params;
  return <ProductEditorPage productId={id} />;
}
