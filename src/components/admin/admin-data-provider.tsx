"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { slugify } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type {
  Banner,
  Category,
  Coupon,
  HomeSection,
  OrderStatus,
  Product,
  StoreData,
  StoreSettings,
} from "@/types/store";

type OrderedEntity = Product | Banner | Category | HomeSection;
type OrderedKey = "products" | "banners" | "categories" | "sections";

interface AdminDataContextValue {
  data: StoreData;
  demoMode: boolean;
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  saveBanner: (banner: Banner) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<boolean>;
  saveSection: (section: HomeSection) => Promise<void>;
  saveCoupon: (coupon: Coupon) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  moveItem: (key: OrderedKey, id: string, direction: -1 | 1) => Promise<void>;
  toggleItem: (key: OrderedKey, id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  saveSettings: (settings: StoreSettings) => Promise<void>;
  uploadMedia: (file: File, bucket: "product-media" | "banner-media") => Promise<string>;
  clearOrders: () => Promise<void>;
  resetData: () => void;
  importData: (data: StoreData) => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

export function AdminDataProvider({ initialData, children }: { initialData: StoreData; children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const [remoteData, setRemoteData] = useState(initialData);
  const demoMode = store.demoMode;
  const data = demoMode ? store.data : remoteData;
  const setData = demoMode ? store.setData : setRemoteData;
  const supabase = useMemo(() => createClient(), []);

  const persist = useCallback(
    async (table: string, row: Record<string, unknown>) => {
      if (!supabase) return;
      const { error } = await supabase.from(table).upsert(row);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const remove = useCallback(
    async (table: string, id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const update = useCallback(
    async (table: string, id: string, row: Record<string, unknown>) => {
      if (!supabase) return;
      const { error } = await supabase.from(table).update(row).eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const saveProduct = useCallback(async (product: Product) => {
    setData((current) => ({ ...current, products: current.products.some((item) => item.id === product.id) ? current.products.map((item) => item.id === product.id ? product : item) : [...current.products, product] }));
    await persist("products", { id: product.id, slug: product.slug, name: product.name, category_id: product.categoryId, brand: product.brand, price: product.price, compare_at: product.compareAt, stock: product.stock, badge: product.badge, accent: product.accent, description: product.description, sku: product.sku, rating: product.rating, reviews: product.reviews, featured: product.featured, active: product.active, order_index: product.order, image_url: product.imageUrl });
    toast("Produto salvo.");
  }, [persist, setData, toast]);

  const deleteProduct = useCallback(async (id: string) => {
    setData((current) => ({ ...current, products: current.products.filter((item) => item.id !== id) }));
    await remove("products", id);
    toast("Produto excluído.");
  }, [remove, setData, toast]);

  const saveBanner = useCallback(async (banner: Banner) => {
    setData((current) => ({ ...current, banners: current.banners.some((item) => item.id === banner.id) ? current.banners.map((item) => item.id === banner.id ? banner : item) : [...current.banners, banner] }));
    await persist("banners", { id: banner.id, kicker: banner.kicker, title: banner.title, highlight: banner.highlight, subtitle: banner.subtitle, button_text: banner.buttonText, button_link: banner.buttonLink, start_color: banner.startColor, end_color: banner.endColor, image_url: banner.imageUrl, active: banner.active, order_index: banner.order });
    toast("Banner salvo.");
  }, [persist, setData, toast]);

  const deleteBanner = useCallback(async (id: string) => {
    setData((current) => ({ ...current, banners: current.banners.filter((item) => item.id !== id) }));
    await remove("banners", id);
    toast("Banner excluído.");
  }, [remove, setData, toast]);

  const saveCategory = useCallback(async (category: Category) => {
    setData((current) => {
      const old = current.categories.find((item) => item.id === category.id);
      return {
        ...current,
        categories: old ? current.categories.map((item) => item.id === category.id ? category : item) : [...current.categories, category],
        products: old && old.name !== category.name ? current.products.map((product) => product.categoryId === category.id ? { ...product, category: category.name } : product) : current.products,
      };
    });
    await persist("categories", { id: category.id, name: category.name, slug: slugify(category.name), active: category.active, order_index: category.order });
    toast("Categoria salva.");
  }, [persist, setData, toast]);

  const deleteCategory = useCallback(async (id: string) => {
    if (data.products.some((product) => product.categoryId === id)) {
      toast("Mova os produtos desta categoria antes de excluí-la.");
      return false;
    }
    setData((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== id) }));
    await remove("categories", id);
    toast("Categoria excluida.");
    return true;
  }, [data.products, remove, setData, toast]);

  const saveSection = useCallback(async (section: HomeSection) => {
    setData((current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? section : item) }));
    await persist("home_sections", { id: section.id, kind: section.kind, name: section.name, eyebrow: section.eyebrow, title: section.title, subtitle: section.subtitle, button_text: section.buttonText ?? "", button_link: section.buttonLink ?? "", active: section.active, order_index: section.order });
    toast("Seção salva.");
  }, [persist, setData, toast]);

  const saveCoupon = useCallback(async (coupon: Coupon) => {
    setData((current) => ({ ...current, coupons: current.coupons.some((item) => item.id === coupon.id) ? current.coupons.map((item) => item.id === coupon.id ? coupon : item) : [...current.coupons, coupon] }));
    await persist("coupons", { id: coupon.id, code: coupon.code, discount_type: coupon.type, value: coupon.value, minimum: coupon.minimum, active: coupon.active, expires_at: coupon.expiresAt || null });
    toast("Cupom salvo.");
  }, [persist, setData, toast]);

  const deleteCoupon = useCallback(async (id: string) => {
    setData((current) => ({ ...current, coupons: current.coupons.filter((item) => item.id !== id) }));
    await remove("coupons", id);
    toast("Cupom excluído.");
  }, [remove, setData, toast]);

  const moveItem = useCallback(async (key: OrderedKey, id: string, direction: -1 | 1) => {
    let nextList: OrderedEntity[] = [];
    setData((current) => {
      const list = [...(current[key] as OrderedEntity[])].sort((a, b) => a.order - b.order);
      const index = list.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      nextList = list.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
      return { ...current, [key]: nextList } as StoreData;
    });
    if (supabase && nextList.length) {
      const table = key === "sections" ? "home_sections" : key;
      await Promise.all(nextList.map((item) => update(table, item.id, { order_index: item.order })));
    }
  }, [setData, supabase, update]);

  const toggleItem = useCallback(async (key: OrderedKey, id: string) => {
    let changed: OrderedEntity | undefined;
    setData((current) => {
      const next = (current[key] as OrderedEntity[]).map((item) => item.id === id ? (changed = { ...item, active: !item.active }) : item);
      return { ...current, [key]: next } as StoreData;
    });
    if (changed) await update(key === "sections" ? "home_sections" : key, id, { active: changed.active });
  }, [setData, update]);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    setData((current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, status } : order) }));
    await update("orders", id, { status });
    toast("Status atualizado.");
  }, [setData, toast, update]);

  const saveSettings = useCallback(async (settings: StoreSettings) => {
    setData((current) => ({ ...current, settings }));
    await persist("store_settings", { id: "default", store_name: settings.storeName, whatsapp: settings.whatsapp, email: settings.email, hours: settings.hours, announcement: settings.announcement, footer_description: settings.footerDescription, primary_color: settings.primaryColor, free_shipping_threshold: settings.freeShippingThreshold, shipping_flat: settings.shippingFlat, pix_discount: settings.pixDiscount, auto_banner_seconds: settings.autoBannerSeconds });
    toast("Configurações salvas.");
  }, [persist, setData, toast]);

  const uploadMedia = useCallback(async (file: File, bucket: "product-media" | "banner-media") => {
    if (!supabase) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
    }
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false });
    if (error) throw new Error(error.message);
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }, [supabase]);

  const clearOrders = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.from("orders").delete().neq("id", "");
      if (error) throw new Error(error.message);
    }
    setData((current) => ({ ...current, orders: [] }));
    toast("Pedidos demonstrativos removidos.");
  }, [setData, supabase, toast]);

  const value = useMemo<AdminDataContextValue>(() => ({
    data,
    demoMode,
    saveProduct,
    deleteProduct,
    saveBanner,
    deleteBanner,
    saveCategory,
    deleteCategory,
    saveSection,
    saveCoupon,
    deleteCoupon,
    moveItem,
    toggleItem,
    updateOrderStatus,
    saveSettings,
    uploadMedia,
    clearOrders,
    resetData: store.resetData,
    importData: store.importData,
  }), [data, demoMode, saveProduct, deleteProduct, saveBanner, deleteBanner, saveCategory, deleteCategory, saveSection, saveCoupon, deleteCoupon, moveItem, toggleItem, updateOrderStatus, saveSettings, uploadMedia, clearOrders, store.resetData, store.importData]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used inside AdminDataProvider");
  return context;
}
