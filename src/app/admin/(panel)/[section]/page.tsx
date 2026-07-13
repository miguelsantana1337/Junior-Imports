import { notFound } from "next/navigation";
import { BannersAdmin } from "@/components/admin/banners-admin";
import { CategoriesAdmin } from "@/components/admin/categories-admin";
import { CouponsAdmin } from "@/components/admin/coupons-admin";
import { DataAdmin } from "@/components/admin/data-admin";
import { OrdersAdmin } from "@/components/admin/orders-admin";
import { LayoutAdmin } from "@/components/admin/layout-admin";
import { MessagesAdmin } from "@/components/admin/messages-admin";
import { ProductsAdmin } from "@/components/admin/products-admin";
import { SectionsAdmin } from "@/components/admin/sections-admin";
import { SettingsAdmin } from "@/components/admin/settings-admin";
import { UsersAdmin } from "@/components/admin/users-admin";
import { sectionPermissions } from "@/lib/admin-permissions";
import { requireAdmin } from "@/lib/require-admin";

const sections = {
  products: ProductsAdmin,
  banners: BannersAdmin,
  categories: CategoriesAdmin,
  sections: SectionsAdmin,
  layout: LayoutAdmin,
  coupons: CouponsAdmin,
  orders: OrdersAdmin,
  messages: MessagesAdmin,
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
