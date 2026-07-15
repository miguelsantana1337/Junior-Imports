import { ProductEditorPage } from "@/components/admin/product-editor-page";
import { requireAdmin } from "@/lib/require-admin";

export default async function NewProductPage() {
  await requireAdmin("catalog");
  return <ProductEditorPage />;
}
