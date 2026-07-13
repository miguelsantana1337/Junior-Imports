import { notFound } from "next/navigation";
import { BannersAdmin } from "@/components/admin/banners-admin";
import { CategoriesAdmin } from "@/components/admin/categories-admin";
import { CouponsAdmin } from "@/components/admin/coupons-admin";
import { DataAdmin } from "@/components/admin/data-admin";
import { OrdersAdmin } from "@/components/admin/orders-admin";
import { ProductsAdmin } from "@/components/admin/products-admin";
import { SectionsAdmin } from "@/components/admin/sections-admin";
import { SettingsAdmin } from "@/components/admin/settings-admin";

const sections = {
  products: ProductsAdmin,
  banners: BannersAdmin,
  categories: CategoriesAdmin,
  sections: SectionsAdmin,
  coupons: CouponsAdmin,
  orders: OrdersAdmin,
  settings: SettingsAdmin,
  data: DataAdmin,
};

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const Component = sections[section as keyof typeof sections];
  if (!Component) notFound();
  return <Component />;
}
