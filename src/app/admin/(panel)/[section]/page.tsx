import { notFound } from "next/navigation";
import { BannersAdmin } from "@/components/admin/banners-admin";
import { CategoriesAdmin } from "@/components/admin/categories-admin";
import { CatalogImportAdmin } from "@/components/admin/catalog-import-admin";
import { CouponsAdmin } from "@/components/admin/coupons-admin";
import { CrmAdmin } from "@/components/admin/crm-admin";
import { CustomersAdmin } from "@/components/admin/customers-admin";
import { DataAdmin } from "@/components/admin/data-admin";
import { OrdersAdmin } from "@/components/admin/orders-admin";
import { LayoutAdmin } from "@/components/admin/layout-admin";
import { FinanceAdmin } from "@/components/admin/finance-admin";
import { InventoryAdmin } from "@/components/admin/inventory-admin";
import { MessagesAdmin } from "@/components/admin/messages-admin";
import { ProductsAdmin } from "@/components/admin/products-admin";
import { PurchasingAdmin } from "@/components/admin/purchasing-admin";
import { SectionsAdmin } from "@/components/admin/sections-admin";
import { SecurityMfaAdmin } from "@/components/admin/security-mfa-admin";
import { SettingsAdmin } from "@/components/admin/settings-admin";
import { UsersAdmin } from "@/components/admin/users-admin";
import { sectionPermissions } from "@/lib/admin-permissions";
import { requireAdmin } from "@/lib/require-admin";

const sections = {
  products: ProductsAdmin,
  banners: BannersAdmin,
  categories: CategoriesAdmin,
  import: CatalogImportAdmin,
  sections: SectionsAdmin,
  layout: LayoutAdmin,
  coupons: CouponsAdmin,
  crm: CrmAdmin,
  customers: CustomersAdmin,
  orders: OrdersAdmin,
  finance: FinanceAdmin,
  inventory: InventoryAdmin,
  purchasing: PurchasingAdmin,
  messages: MessagesAdmin,
  security: SecurityMfaAdmin,
  settings: SettingsAdmin,
  users: UsersAdmin,
  data: DataAdmin,
};

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const Component = sections[section as keyof typeof sections];
  if (!Component) notFound();
  await requireAdmin(sectionPermissions[section]);
  return <Component />;
}
