"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useStore } from "@/components/providers/store-provider";
import { useToast } from "@/components/providers/toast-provider";
import { slugify } from "@/lib/format";
import { createMessageLogs } from "@/lib/message-automation";
import {
  createUniqueProductSlug,
  ensureUniqueProductSlugs,
  ProductSaveConflictError,
  toProductSaveError,
} from "@/lib/product-slug";
import { createClient } from "@/lib/supabase/client";
import { applyStockImport, type StockImportRow } from "@/lib/catalog-import";
import {
  readSensitiveSessionValue,
  removeSensitiveBrowserValue,
  writeSensitiveSessionValue,
} from "@/lib/browser-storage";
import { calculateCart } from "@/lib/commerce";
import { validateCouponForCustomer } from "@/lib/coupon-rules";
import { normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/crm";
import { applyCreatedOrder } from "@/lib/order-state";
import { normalizeAdminStoreData } from "@/lib/admin-store-data";
import type {
  AdminPermission,
  AdminRole,
  AdminUser,
  Banner,
  CatalogImportRun,
  Category,
  Coupon,
  Customer,
  CustomerContact,
  CustomerTask,
  FinancialTransaction,
  HomeSection,
  InventoryMovement,
  MessageAutomation,
  Order,
  OrderStatus,
  PageBlock,
  Product,
  ProductLot,
  PurchaseOrder,
  StorePage,
  StoreData,
  StoreSettings,
  StockImportMode,
  Supplier,
} from "@/types/store";
import type { AdminUserCreateInput, AdminUserUpdateInput, ManualOrderInput } from "@/lib/validation";

type OrderedEntity = Product | Banner | Category | HomeSection;
type OrderedKey = "products" | "banners" | "categories" | "sections";
type PersistedOrder = {
  id: string;
  customer_id?: string;
  code: string;
  created_at: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  cashback_total?: number;
  status: OrderStatus;
  order_source?: Order["orderSource"];
  reservation_expires_at?: string;
};

interface AdminDataContextValue {
  data: StoreData;
  demoMode: boolean;
  currentUser: { id: string; fullName: string; email: string; role: AdminRole; permissions: AdminPermission[] };
  saveProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  saveBanner: (banner: Banner) => Promise<void>;
  deleteBanner: (id: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<boolean>;
  saveSection: (section: HomeSection) => Promise<void>;
  savePage: (page: StorePage) => Promise<void>;
  deletePage: (id: string) => Promise<void>;
  savePageBlock: (block: PageBlock) => Promise<void>;
  deletePageBlock: (id: string) => Promise<void>;
  movePageBlock: (pageId: string, id: string, direction: -1 | 1) => Promise<void>;
  saveMessageAutomation: (automation: MessageAutomation) => Promise<void>;
  deleteMessageAutomation: (id: string) => Promise<void>;
  saveCoupon: (coupon: Coupon) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
  saveCustomer: (customer: Customer) => Promise<void>;
  saveCustomerTask: (task: CustomerTask) => Promise<void>;
  deleteCustomerTask: (id: string) => Promise<void>;
  saveCustomerContact: (contact: CustomerContact) => Promise<void>;
  createOrder: (input: ManualOrderInput) => Promise<Order>;
  saveFinancialTransaction: (transaction: FinancialTransaction) => Promise<void>;
  deleteFinancialTransaction: (id: string) => Promise<void>;
  recordInventoryMovement: (movement: InventoryMovement) => Promise<void>;
  saveProductLot: (lot: ProductLot) => Promise<void>;
  saveSupplier: (supplier: Supplier) => Promise<void>;
  savePurchaseOrder: (order: PurchaseOrder) => Promise<void>;
  receivePurchaseOrder: (id: string) => Promise<void>;
  importProducts: (products: Product[], filename: string) => Promise<void>;
  importStock: (rows: StockImportRow[], mode: StockImportMode, filename: string) => Promise<void>;
  moveItem: (key: OrderedKey, id: string, direction: -1 | 1) => Promise<void>;
  reorderItem: (key: OrderedKey, id: string, targetIndex: number) => Promise<void>;
  toggleItem: (key: OrderedKey, id: string) => Promise<void>;
  updateOrderStatus: (id: string, status: OrderStatus) => Promise<void>;
  saveOrderDetails: (id: string, details: { internalNotes: string; trackingCode: string }) => Promise<void>;
  saveSettings: (settings: StoreSettings) => Promise<void>;
  uploadMedia: (file: File, bucket: "product-media" | "banner-media" | "site-media") => Promise<string>;
  clearOrders: () => Promise<void>;
  refreshTeamMembers: () => Promise<void>;
  createAdminUser: (user: AdminUserCreateInput) => Promise<void>;
  updateAdminUser: (user: AdminUserUpdateInput) => Promise<void>;
  deleteAdminUser: (id: string) => Promise<void>;
  resetData: () => void;
  importData: (data: StoreData) => void;
}

const AdminDataContext = createContext<AdminDataContextValue | null>(null);

function productRecord(product: Product) {
  return { id: product.id, slug: product.slug, name: product.name, category_id: product.categoryId, brand: product.brand, price: product.price, compare_at: product.compareAt, cashback: product.cashback, cost_price: product.costPrice, stock: product.stock, min_stock: product.minStock, badge: product.badge, accent: product.accent, description: product.description, sku: product.sku, rating: product.rating, reviews: product.reviews, featured: product.featured, active: product.active, order_index: product.order, image_url: product.imageUrl, image_urls: product.imageUrls, product_type: product.productType, regulatory_status: product.regulatoryStatus, active_ingredient: product.activeIngredient, anvisa_registration: product.anvisaRegistration, presentation: product.presentation, regulatory_warning: product.regulatoryWarning, pharmacist_reviewed: product.pharmacistReviewed };
}

export function AdminDataProvider({ initialData, currentUser, children }: { initialData: StoreData; currentUser: AdminDataContextValue["currentUser"]; children: ReactNode }) {
  const store = useStore();
  const toast = useToast();
  const [data, setData] = useState(initialData);
  const demoMode = store.demoMode;
  const supabase = useMemo(() => createClient(), []);
  const dataRef = useRef(data);
  const initialDataRef = useRef(initialData);
  const mutationQueue = useRef<Promise<void>>(Promise.resolve());
  const demoDataKey = `${initialData.tenant.id}:store-data:v1`;

  useEffect(() => {
    if (!demoMode) {
      removeSensitiveBrowserValue(demoDataKey);
      return;
    }
    try {
      const stored = readSensitiveSessionValue(demoDataKey);
      if (stored) setData(normalizeAdminStoreData(JSON.parse(stored), initialDataRef.current));
    } catch {
      removeSensitiveBrowserValue(demoDataKey);
    }
  }, [demoDataKey, demoMode]);

  useEffect(() => {
    if (demoMode) writeSensitiveSessionValue(demoDataKey, JSON.stringify(data));
  }, [data, demoDataKey, demoMode]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const commitMutation = useCallback((
    apply: (current: StoreData) => StoreData,
    execute: (next: StoreData, previous: StoreData) => Promise<void>,
    successMessage?: string,
  ) => {
    const run = async () => {
      const previous = dataRef.current;
      const next = apply(previous);
      if (next === previous) return;
      dataRef.current = next;
      setData(next);
      try {
        await execute(next, previous);
        if (successMessage) toast({ message: successMessage, kind: "success" });
      } catch (caught) {
        dataRef.current = previous;
        setData(previous);
        const message = caught instanceof Error ? caught.message : "Não foi possível salvar a alteração.";
        toast({ message: `A alteração foi desfeita. ${message}`, kind: "error", duration: 6000 });
        throw caught;
      }
    };
    const operation = mutationQueue.current.then(run, run);
    mutationQueue.current = operation.then(() => undefined, () => undefined);
    return operation;
  }, [setData, toast]);

  const persist = useCallback(
    async (table: string, row: Record<string, unknown>) => {
      if (!supabase) return;
      const { error } = await supabase.from(table).upsert({ ...row, tenant_id: dataRef.current.tenant.id });
      if (error) throw table === "products" ? toProductSaveError(error) : new Error(error.message);
    },
    [supabase],
  );

  const remove = useCallback(
    async (table: string, id: string) => {
      if (!supabase) return;
      const { error } = await supabase.from(table).delete().eq("tenant_id", dataRef.current.tenant.id).eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const update = useCallback(
    async (table: string, id: string, row: Record<string, unknown>) => {
      if (!supabase) return;
      const { error } = await supabase.from(table).update(row).eq("tenant_id", dataRef.current.tenant.id).eq("id", id);
      if (error) throw new Error(error.message);
    },
    [supabase],
  );

  const persistOrder = useCallback(async (table: string, items: Array<{ id: string; order: number }>) => {
    if (!supabase || !items.length) return;
    const { error } = await supabase.rpc("reorder_admin_items", {
      p_table: table,
      p_items: items.map((item) => ({ id: item.id, order: item.order })),
      p_tenant_id: dataRef.current.tenant.id,
    });
    if (!error) return;
    if (error.code === "PGRST202" || error.code === "42883") {
      await Promise.all(items.map((item) => update(table, item.id, { order_index: item.order })));
      return;
    }
    throw new Error(error.message);
  }, [supabase, update]);

  const reconcilePersistedProductSlugs = useCallback((rows: Array<{ id: string; slug: string }>) => {
    if (!rows.length) return;
    const persistedSlugs = new Map(rows.map((row) => [row.id, row.slug]));
    const current = dataRef.current;
    let changed = false;
    const products = current.products.map((product) => {
      const slug = persistedSlugs.get(product.id);
      if (!slug || slug === product.slug) return product;
      changed = true;
      return { ...product, slug };
    });
    if (!changed) return;
    const next = { ...current, products };
    dataRef.current = next;
    setData(next);
  }, [setData]);

  const persistProduct = useCallback(async (product: Product) => {
    if (!supabase) return product;
    const retrySeeds = [
      product.slug,
      `${product.slug}-${slugify(product.sku) || "item"}`,
      `${product.slug}-${slugify(product.id)}`,
    ];
    let lastError: Error | undefined;

    for (const seed of retrySeeds) {
      const candidate = {
        ...product,
        slug: createUniqueProductSlug(seed, dataRef.current.products, product.id),
      };
      const { data: saved, error } = await supabase
        .from("products")
        .upsert({ ...productRecord(candidate), tenant_id: dataRef.current.tenant.id })
        .select("id, slug")
        .single();
      if (!error) return { ...candidate, slug: saved?.slug || candidate.slug };

      const friendlyError = toProductSaveError(error);
      lastError = friendlyError;
      if (!(friendlyError instanceof ProductSaveConflictError) || friendlyError.kind !== "slug") {
        throw friendlyError;
      }
    }

    throw lastError ?? new ProductSaveConflictError("slug");
  }, [supabase]);

  const saveProduct = useCallback(async (product: Product) => {
    let candidate = product;
    await commitMutation(
      (current) => {
        [candidate] = ensureUniqueProductSlugs([product], current.products);
        return {
          ...current,
          products: current.products.some((item) => item.id === candidate.id)
            ? current.products.map((item) => item.id === candidate.id ? candidate : item)
            : [...current.products, candidate],
        };
      },
      async () => {
        const persisted = await persistProduct(candidate);
        reconcilePersistedProductSlugs([{ id: persisted.id, slug: persisted.slug }]);
      },
      "Produto salvo.",
    );
  }, [commitMutation, persistProduct, reconcilePersistedProductSlugs]);

  const deleteProduct = useCallback(async (id: string) => {
    await commitMutation(
      (current) => ({ ...current, products: current.products.filter((item) => item.id !== id) }),
      () => remove("products", id),
      "Produto excluído.",
    );
  }, [commitMutation, remove]);

  const saveBanner = useCallback(async (banner: Banner) => {
    await commitMutation(
      (current) => ({ ...current, banners: current.banners.some((item) => item.id === banner.id) ? current.banners.map((item) => item.id === banner.id ? banner : item) : [...current.banners, banner] }),
      () => persist("banners", { id: banner.id, kicker: banner.kicker, title: banner.title, highlight: banner.highlight, subtitle: banner.subtitle, button_text: banner.buttonText, button_link: banner.buttonLink, start_color: banner.startColor, end_color: banner.endColor, image_url: banner.imageUrl, mobile_image_url: banner.mobileImageUrl, alt_text: banner.altText, image_only: banner.imageOnly, active: banner.active, order_index: banner.order }),
      "Banner salvo.",
    );
  }, [commitMutation, persist]);

  const deleteBanner = useCallback(async (id: string) => {
    await commitMutation((current) => ({ ...current, banners: current.banners.filter((item) => item.id !== id) }), () => remove("banners", id), "Banner excluído.");
  }, [commitMutation, remove]);

  const saveCategory = useCallback(async (category: Category) => {
    await commitMutation((current) => {
      const old = current.categories.find((item) => item.id === category.id);
      return {
        ...current,
        categories: old ? current.categories.map((item) => item.id === category.id ? category : item) : [...current.categories, category],
        products: old && old.name !== category.name ? current.products.map((product) => product.categoryId === category.id ? { ...product, category: category.name } : product) : current.products,
      };
    }, () => persist("categories", { id: category.id, name: category.name, slug: slugify(category.name), active: category.active, order_index: category.order }), "Categoria salva.");
  }, [commitMutation, persist]);

  const deleteCategory = useCallback(async (id: string) => {
    if (dataRef.current.products.some((product) => product.categoryId === id)) {
      toast({ message: "Mova os produtos desta categoria antes de excluí-la.", kind: "error" });
      return false;
    }
    await commitMutation((current) => ({ ...current, categories: current.categories.filter((item) => item.id !== id) }), () => remove("categories", id), "Categoria excluída.");
    return true;
  }, [commitMutation, remove, toast]);

  const saveSection = useCallback(async (section: HomeSection) => {
    await commitMutation(
      (current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? section : item) }),
      () => persist("home_sections", { id: section.id, kind: section.kind, name: section.name, eyebrow: section.eyebrow, title: section.title, subtitle: section.subtitle, button_text: section.buttonText ?? "", button_link: section.buttonLink ?? "", active: section.active, order_index: section.order }),
      "Seção salva.",
    );
  }, [commitMutation, persist]);

  const savePage = useCallback(async (page: StorePage) => {
    await commitMutation((current) => ({
      ...current,
      pages: current.pages.some((item) => item.id === page.id)
        ? current.pages.map((item) => item.id === page.id ? page : item)
        : [...current.pages, page],
    }), () => persist("store_pages", { id: page.id, name: page.name, slug: page.slug, title: page.title, description: page.description, active: page.active, show_in_navigation: page.showInNavigation, is_home: page.isHome, order_index: page.order }), "Página salva.");
  }, [commitMutation, persist]);

  const deletePage = useCallback(async (id: string) => {
    if (id === "home") return;
    await commitMutation((current) => ({
      ...current,
      pages: current.pages.filter((page) => page.id !== id),
      pageBlocks: current.pageBlocks.filter((block) => block.pageId !== id),
    }), () => remove("store_pages", id), "Página excluída.");
  }, [commitMutation, remove]);

  const savePageBlock = useCallback(async (block: PageBlock) => {
    await commitMutation((current) => ({
      ...current,
      pageBlocks: current.pageBlocks.some((item) => item.id === block.id)
        ? current.pageBlocks.map((item) => item.id === block.id ? block : item)
        : [...current.pageBlocks, block],
    }), () => persist("page_blocks", { id: block.id, page_id: block.pageId, kind: block.kind, name: block.name, eyebrow: block.eyebrow, title: block.title, body: block.body, button_text: block.buttonText, button_link: block.buttonLink, image_url: block.imageUrl, background_color: block.backgroundColor, text_color: block.textColor, container_width: block.containerWidth, padding_size: block.padding, columns_count: block.columns, active: block.active, order_index: block.order }), "Container salvo.");
  }, [commitMutation, persist]);

  const deletePageBlock = useCallback(async (id: string) => {
    await commitMutation((current) => ({ ...current, pageBlocks: current.pageBlocks.filter((block) => block.id !== id) }), () => remove("page_blocks", id), "Container excluído.");
  }, [commitMutation, remove]);

  const movePageBlock = useCallback(async (pageId: string, id: string, direction: -1 | 1) => {
    await commitMutation((current) => {
      const pageBlocks = current.pageBlocks.filter((block) => block.pageId === pageId).sort((a, b) => a.order - b.order);
      const index = pageBlocks.findIndex((block) => block.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= pageBlocks.length) return current;
      [pageBlocks[index], pageBlocks[target]] = [pageBlocks[target], pageBlocks[index]];
      const ordered = pageBlocks.map((block, blockIndex) => ({ ...block, order: blockIndex + 1 }));
      const replacements = new Map(ordered.map((block) => [block.id, block]));
      return { ...current, pageBlocks: current.pageBlocks.map((block) => replacements.get(block.id) ?? block) };
    }, (next) => persistOrder("page_blocks", next.pageBlocks.filter((block) => block.pageId === pageId)));
  }, [commitMutation, persistOrder]);

  const saveMessageAutomation = useCallback(async (automation: MessageAutomation) => {
    await commitMutation((current) => ({
      ...current,
      messageAutomations: current.messageAutomations.some((item) => item.id === automation.id)
        ? current.messageAutomations.map((item) => item.id === automation.id ? automation : item)
        : [...current.messageAutomations, automation],
    }), () => persist("message_automations", { id: automation.id, name: automation.name, trigger_status: automation.triggerStatus, channel: automation.channel, subject: automation.subject, message: automation.message, active: automation.active, order_index: automation.order }), "Automação salva.");
  }, [commitMutation, persist]);

  const deleteMessageAutomation = useCallback(async (id: string) => {
    await commitMutation((current) => ({ ...current, messageAutomations: current.messageAutomations.filter((automation) => automation.id !== id) }), () => remove("message_automations", id), "Automação excluída.");
  }, [commitMutation, remove]);

  const saveCoupon = useCallback(async (coupon: Coupon) => {
    await commitMutation(
      (current) => ({ ...current, coupons: current.coupons.some((item) => item.id === coupon.id) ? current.coupons.map((item) => item.id === coupon.id ? coupon : item) : [...current.coupons, coupon] }),
      () => persist("coupons", { id: coupon.id, code: coupon.code, discount_type: coupon.type, value: coupon.value, minimum: coupon.minimum, active: coupon.active, starts_at: coupon.startsAt || null, expires_at: coupon.expiresAt || null, total_usage_limit: coupon.totalUsageLimit, per_customer_limit: coupon.perCustomerLimit, first_order_only: coupon.firstOrderOnly }),
      "Cupom salvo.",
    );
  }, [commitMutation, persist]);

  const deleteCoupon = useCallback(async (id: string) => {
    await commitMutation((current) => ({ ...current, coupons: current.coupons.filter((item) => item.id !== id) }), () => remove("coupons", id), "Cupom excluído.");
  }, [commitMutation, remove]);

  const saveCustomer = useCallback(async (customer: Customer) => {
    await commitMutation(
      (current) => ({
        ...current,
        customers: current.customers.some((item) => item.id === customer.id)
          ? current.customers.map((item) => item.id === customer.id ? customer : item)
          : [...current.customers, customer],
      }),
      () => persist("customers", { id: customer.id, name: customer.name, email: customer.email, phone: customer.phone, normalized_email: normalizeCustomerEmail(customer.email), normalized_phone: normalizeCustomerPhone(customer.phone), city: customer.city, state: customer.state, source: customer.source, tags: customer.tags, notes: customer.notes, assigned_to: customer.assignedTo, whatsapp_consent: customer.whatsappConsent, email_consent: customer.emailConsent, updated_at: new Date().toISOString() }),
      "Cliente atualizado.",
    );
  }, [commitMutation, persist]);

  const saveCustomerTask = useCallback(async (task: CustomerTask) => {
    await commitMutation(
      (current) => ({ ...current, customerTasks: current.customerTasks.some((item) => item.id === task.id) ? current.customerTasks.map((item) => item.id === task.id ? task : item) : [task, ...current.customerTasks] }),
      () => persist("customer_tasks", { id: task.id, customer_id: task.customerId, title: task.title, due_at: task.dueAt || null, priority: task.priority, status: task.status, assigned_to: task.assignedTo, notes: task.notes, completed_at: task.completedAt || null, created_at: task.createdAt }),
      task.status === "completed" ? "Tarefa concluída." : "Tarefa salva.",
    );
  }, [commitMutation, persist]);

  const deleteCustomerTask = useCallback(async (id: string) => {
    await commitMutation((current) => ({ ...current, customerTasks: current.customerTasks.filter((task) => task.id !== id) }), () => remove("customer_tasks", id), "Tarefa excluída.");
  }, [commitMutation, remove]);

  const saveCustomerContact = useCallback(async (contact: CustomerContact) => {
    await commitMutation(
      (current) => ({ ...current, customerContacts: [contact, ...current.customerContacts.filter((item) => item.id !== contact.id)] }),
      () => persist("customer_contacts", { id: contact.id, customer_id: contact.customerId, channel: contact.channel, result: contact.result, summary: contact.summary, next_step_at: contact.nextStepAt || null, actor_email: contact.actorEmail, created_at: contact.createdAt }),
      "Contato registrado na timeline.",
    );
  }, [commitMutation, persist]);

  const saveFinancialTransaction = useCallback(async (transaction: FinancialTransaction) => {
    await commitMutation(
      (current) => ({ ...current, financialTransactions: current.financialTransactions.some((item) => item.id === transaction.id) ? current.financialTransactions.map((item) => item.id === transaction.id ? transaction : item) : [transaction, ...current.financialTransactions] }),
      () => persist("financial_transactions", { id: transaction.id, type: transaction.type, status: transaction.status, description: transaction.description, amount: transaction.amount, category: transaction.category, account: transaction.account, cost_center: transaction.costCenter, due_date: transaction.dueDate || null, paid_at: transaction.paidAt || null, order_id: transaction.orderId || null, purchase_order_id: transaction.purchaseOrderId || null, recurring: transaction.recurring, notes: transaction.notes, created_at: transaction.createdAt }),
      "Lançamento financeiro salvo.",
    );
  }, [commitMutation, persist]);

  const deleteFinancialTransaction = useCallback(async (id: string) => {
    await commitMutation((current) => ({ ...current, financialTransactions: current.financialTransactions.filter((item) => item.id !== id) }), () => remove("financial_transactions", id), "Lançamento excluído.");
  }, [commitMutation, remove]);

  const recordInventoryMovement = useCallback(async (movement: InventoryMovement) => {
    await commitMutation(
      (current) => ({
        ...current,
        products: current.products.map((product) => product.id === movement.productId ? { ...product, stock: movement.balanceAfter } : product),
        inventoryMovements: [movement, ...current.inventoryMovements],
      }),
      async () => {
        if (!supabase) return;
        const { error } = await supabase.rpc("record_inventory_movement", {
          p_tenant_id: dataRef.current.tenant.id,
          p_product_id: movement.productId,
          p_type: movement.type,
          p_quantity: Math.abs(movement.quantity),
          p_unit_cost: movement.unitCost,
          p_note: movement.note,
          p_reference_type: movement.referenceType,
          p_reference_id: movement.referenceId,
          p_actor_email: movement.actorEmail,
        });
        if (!error) return;
        if (error.code !== "PGRST202" && error.code !== "42883") throw new Error(error.message);
        await update("products", movement.productId, { stock: movement.balanceAfter });
        await persist("inventory_movements", { id: movement.id, product_id: movement.productId, type: movement.type, quantity: movement.quantity, balance_after: movement.balanceAfter, unit_cost: movement.unitCost, reference_type: movement.referenceType, reference_id: movement.referenceId, note: movement.note, actor_email: movement.actorEmail, created_at: movement.createdAt });
      },
      "Movimento de estoque registrado.",
    );
  }, [commitMutation, persist, supabase, update]);

  const saveProductLot = useCallback(async (lot: ProductLot) => {
    await commitMutation(
      (current) => ({ ...current, productLots: current.productLots.some((item) => item.id === lot.id) ? current.productLots.map((item) => item.id === lot.id ? lot : item) : [lot, ...current.productLots] }),
      () => persist("product_lots", { id: lot.id, product_id: lot.productId, code: lot.code, expiry_date: lot.expiryDate || null, quantity: lot.quantity, status: lot.status, created_at: lot.createdAt }),
      "Lote salvo.",
    );
  }, [commitMutation, persist]);

  const saveSupplier = useCallback(async (supplier: Supplier) => {
    await commitMutation(
      (current) => ({ ...current, suppliers: current.suppliers.some((item) => item.id === supplier.id) ? current.suppliers.map((item) => item.id === supplier.id ? supplier : item) : [...current.suppliers, supplier] }),
      () => persist("suppliers", { id: supplier.id, name: supplier.name, tax_id: supplier.taxId, email: supplier.email, phone: supplier.phone, lead_time_days: supplier.leadTimeDays, notes: supplier.notes, active: supplier.active, created_at: supplier.createdAt }),
      "Fornecedor salvo.",
    );
  }, [commitMutation, persist]);

  const savePurchaseOrder = useCallback(async (order: PurchaseOrder) => {
    await commitMutation(
      (current) => ({ ...current, purchaseOrders: current.purchaseOrders.some((item) => item.id === order.id) ? current.purchaseOrders.map((item) => item.id === order.id ? order : item) : [order, ...current.purchaseOrders] }),
      async () => {
        await persist("purchase_orders", { id: order.id, code: order.code, supplier_id: order.supplierId, status: order.status, expected_at: order.expectedAt || null, received_at: order.receivedAt || null, total: order.total, notes: order.notes, created_at: order.createdAt });
        if (!supabase) return;
        const { error: deleteError } = await supabase.from("purchase_order_items").delete().eq("tenant_id", dataRef.current.tenant.id).eq("purchase_order_id", order.id);
        if (deleteError) throw new Error(deleteError.message);
        if (!order.items.length) return;
        const { error } = await supabase.from("purchase_order_items").insert(order.items.map((item) => ({ tenant_id: dataRef.current.tenant.id, id: item.id, purchase_order_id: order.id, product_id: item.productId, product_name: item.name, quantity: item.quantity, unit_cost: item.unitCost, lot_code: item.lotCode, expiry_date: item.expiryDate || null })));
        if (error) throw new Error(error.message);
      },
      "Ordem de compra salva.",
    );
  }, [commitMutation, persist, supabase]);

  const receivePurchaseOrder = useCallback(async (id: string) => {
    await commitMutation(
      (current) => {
        const order = current.purchaseOrders.find((item) => item.id === id);
        if (!order || order.status === "received" || order.status === "cancelled") return current;
        const receivedAt = new Date().toISOString();
        const products = current.products.map((product) => {
          const item = order.items.find((candidate) => candidate.productId === product.id);
          return item ? { ...product, stock: product.stock + item.quantity, costPrice: item.unitCost } : product;
        });
        const movements: InventoryMovement[] = order.items.map((item) => {
          const product = products.find((candidate) => candidate.id === item.productId)!;
          return { id: `purchase-${order.id}-${item.id}`, productId: item.productId, type: "purchase", quantity: item.quantity, balanceAfter: product.stock, unitCost: item.unitCost, referenceType: "purchase_order", referenceId: order.id, note: `Recebimento da ${order.code}.`, actorEmail: currentUser.email, createdAt: receivedAt };
        });
        const newLots: ProductLot[] = order.items.filter((item) => item.lotCode).map((item) => ({ id: `lot-${order.id}-${item.id}`, productId: item.productId, code: item.lotCode, expiryDate: item.expiryDate, quantity: item.quantity, status: "available", createdAt: receivedAt }));
        const payable: FinancialTransaction = { id: `purchase-payable-${order.id}`, type: "expense", status: "pending", description: `Compra ${order.code}`, amount: order.total, category: "Compras", account: "Conta principal", costCenter: "Estoque", dueDate: order.expectedAt, paidAt: "", orderId: "", purchaseOrderId: order.id, recurring: false, notes: "Gerado pelo recebimento da ordem de compra.", createdAt: receivedAt };
        return {
          ...current,
          products,
          purchaseOrders: current.purchaseOrders.map((item) => item.id === id ? { ...item, status: "received", receivedAt } : item),
          inventoryMovements: [...movements, ...current.inventoryMovements],
          productLots: [...newLots, ...current.productLots.filter((lot) => !newLots.some((item) => item.id === lot.id))],
          financialTransactions: current.financialTransactions.some((item) => item.id === payable.id) ? current.financialTransactions : [payable, ...current.financialTransactions],
        };
      },
      async () => {
        if (!supabase) return;
        const { error } = await supabase.rpc("receive_purchase_order", { p_tenant_id: dataRef.current.tenant.id, p_purchase_order_id: id, p_actor_email: currentUser.email });
        if (error) throw new Error(error.message);
      },
      "Compra recebida: estoque, lote e financeiro atualizados.",
    );
  }, [commitMutation, currentUser.email, supabase]);

  const importProducts = useCallback(async (products: Product[], filename: string) => {
    const run: CatalogImportRun = { id: crypto.randomUUID(), kind: "products", filename, mode: "upsert", totalRows: products.length, successRows: products.length, errorRows: 0, createdAt: new Date().toISOString(), actorEmail: currentUser.email };
    let candidates = products;
    await commitMutation((current) => {
      candidates = ensureUniqueProductSlugs(products, current.products);
      const replacements = new Map(candidates.map((product) => [product.id, product]));
      const existing = current.products.map((product) => replacements.get(product.id) ?? product);
      const existingIds = new Set(current.products.map((product) => product.id));
      return { ...current, products: [...existing, ...candidates.filter((product) => !existingIds.has(product.id))], catalogImports: [run, ...current.catalogImports] };
    }, async () => {
      if (!supabase) return;
      const { data: savedRows, error } = await supabase
        .from("products")
        .upsert(candidates.map((product) => ({ ...productRecord(product), tenant_id: dataRef.current.tenant.id })))
        .select("id, slug");
      if (error) throw toProductSaveError(error);
      reconcilePersistedProductSlugs((savedRows ?? []) as Array<{ id: string; slug: string }>);
      await persist("catalog_imports", { id: run.id, kind: run.kind, filename: run.filename, mode: run.mode, total_rows: run.totalRows, success_rows: run.successRows, error_rows: run.errorRows, created_at: run.createdAt, actor_email: run.actorEmail });
    }, `${products.length} produto${products.length === 1 ? "" : "s"} processado${products.length === 1 ? "" : "s"}.`);
  }, [commitMutation, currentUser.email, persist, reconcilePersistedProductSlugs, supabase]);

  const importStock = useCallback(async (rows: StockImportRow[], mode: StockImportMode, filename: string) => {
    const run: CatalogImportRun = { id: crypto.randomUUID(), kind: "stock", filename, mode, totalRows: rows.length, successRows: rows.length, errorRows: 0, createdAt: new Date().toISOString(), actorEmail: currentUser.email };
    let changed: Product[] = [];
    await commitMutation((current) => {
      const products = applyStockImport(current.products, rows, mode);
      const skus = new Set(rows.map((row) => row.sku.toUpperCase()));
      changed = products.filter((product) => skus.has(product.sku.toUpperCase()));
      return { ...current, products, catalogImports: [run, ...current.catalogImports] };
    }, async () => {
      if (!supabase) return;
      const { error } = await supabase.from("products").upsert(changed.map((product) => ({ ...productRecord(product), tenant_id: dataRef.current.tenant.id })));
      if (error) throw new Error(error.message);
      await persist("catalog_imports", { id: run.id, kind: run.kind, filename: run.filename, mode: run.mode, total_rows: run.totalRows, success_rows: run.successRows, error_rows: run.errorRows, created_at: run.createdAt, actor_email: run.actorEmail });
    }, `Estoque de ${rows.length} produto${rows.length === 1 ? "" : "s"} atualizado.`);
  }, [commitMutation, currentUser.email, persist, supabase]);

  const moveItem = useCallback(async (key: OrderedKey, id: string, direction: -1 | 1) => {
    const table = key === "sections" ? "home_sections" : key;
    await commitMutation((current) => {
      const list = [...(current[key] as OrderedEntity[])].sort((a, b) => a.order - b.order);
      const index = list.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return current;
      [list[index], list[target]] = [list[target], list[index]];
      const nextList = list.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
      return { ...current, [key]: nextList } as StoreData;
    }, (next) => persistOrder(table, next[key] as OrderedEntity[]));
  }, [commitMutation, persistOrder]);

  const reorderItem = useCallback(async (key: OrderedKey, id: string, targetIndex: number) => {
    const table = key === "sections" ? "home_sections" : key;
    await commitMutation((current) => {
      const list = [...(current[key] as OrderedEntity[])].sort((a, b) => a.order - b.order);
      const currentIndex = list.findIndex((item) => item.id === id);
      const boundedTarget = Math.max(0, Math.min(targetIndex, list.length - 1));
      if (currentIndex < 0 || currentIndex === boundedTarget) return current;
      const [moved] = list.splice(currentIndex, 1);
      list.splice(boundedTarget, 0, moved);
      const nextList = list.map((item, itemIndex) => ({ ...item, order: itemIndex + 1 }));
      return { ...current, [key]: nextList } as StoreData;
    }, (next) => persistOrder(table, next[key] as OrderedEntity[]));
  }, [commitMutation, persistOrder]);

  const toggleItem = useCallback(async (key: OrderedKey, id: string) => {
    await commitMutation((current) => {
      const next = (current[key] as OrderedEntity[]).map((item) => item.id === id ? { ...item, active: !item.active } : item);
      return { ...current, [key]: next } as StoreData;
    }, (next) => {
      const changed = (next[key] as OrderedEntity[]).find((item) => item.id === id);
      return changed ? update(key === "sections" ? "home_sections" : key, id, { active: changed.active }) : Promise.resolve();
    });
  }, [commitMutation, update]);

  const createOrder = useCallback(async (input: ManualOrderInput) => {
    const current = dataRef.current;
    const lines = input.items.map((item) => ({ productId: item.productId, quantity: item.quantity }));
    const selectedProducts = input.items.map((item) => {
      const product = current.products.find((candidate) => candidate.id === item.productId);
      if (!product || !product.active) throw new Error("Um dos produtos selecionados não está disponível.");
      if (item.quantity > product.stock) throw new Error(`${product.name} possui apenas ${product.stock} unidade${product.stock === 1 ? "" : "s"} em estoque.`);
      return { product, quantity: item.quantity };
    });
    const customer = {
      name: input.name,
      phone: input.phone,
      email: input.email,
      zip: input.zip,
      city: input.city,
      state: input.state,
      address: input.address,
      number: input.number,
      complement: input.complement,
    };
    const baseCalculation = calculateCart(lines, current.products, current.settings, null, input.payment);
    const couponCode = input.couponCode.trim().toUpperCase();
    const coupon = couponCode
      ? current.coupons.find((candidate) => candidate.code.toUpperCase() === couponCode)
      : null;

    if (couponCode && !coupon) throw new Error("Cupom não encontrado.");
    if (coupon) {
      const eligibility = validateCouponForCustomer(coupon, customer, current.orders, current.couponRedemptions);
      if (!eligibility.valid) throw new Error(eligibility.message);
      if (baseCalculation.subtotal < coupon.minimum) {
        throw new Error(`Este cupom exige um pedido mínimo de R$ ${coupon.minimum.toFixed(2).replace(".", ",")}.`);
      }
    }

    const calculation = calculateCart(lines, current.products, current.settings, coupon, input.payment);
    const items = selectedProducts.map(({ product, quantity }) => ({
      productId: product.id,
      name: product.name,
      quantity,
      unitPrice: product.price,
      unitCost: product.costPrice,
      unitCashback: product.cashback,
    }));
    const nextNumber = current.orders.reduce(
      (max, order) => Math.max(max, Number(order.code.replace(/\D/g, "")) || 1000),
      1000,
    ) + 1;
    let persisted: PersistedOrder | null = null;

    if (!demoMode) {
      const response = await fetch("/api/admin/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => null) as { order?: PersistedOrder; error?: string } | null;
      if (!response.ok || !payload?.order) throw new Error(payload?.error ?? "Não foi possível registrar o pedido.");
      persisted = payload.order;
    }

    const order: Order = {
      id: persisted?.id ?? `order-${crypto.randomUUID()}`,
      customerId: persisted?.customer_id ?? input.customerId,
      code: persisted?.code ?? `${current.settings.orderPrefix || "PED"}-${nextNumber}`,
      createdAt: persisted?.created_at ?? new Date().toISOString(),
      customer,
      items,
      subtotal: persisted?.subtotal ?? calculation.subtotal,
      discount: persisted?.discount ?? calculation.discount,
      shipping: persisted?.shipping ?? calculation.shipping,
      total: persisted?.total ?? calculation.total,
      cashbackTotal: persisted?.cashback_total ?? calculation.cashback,
      payment: input.payment,
      status: persisted?.status ?? "Novo",
      couponCode: coupon?.code ?? "",
      internalNotes: input.internalNotes,
      trackingCode: "",
      orderSource: persisted?.order_source ?? "admin",
      reservationExpiresAt: persisted?.reservation_expires_at ?? "",
    };
    const generatedLogs = createMessageLogs(order, current.messageAutomations);
    const next = applyCreatedOrder(current, order, {
      actorEmail: currentUser.email,
      customerSource: "whatsapp",
      generatedLogs,
    });
    dataRef.current = next;
    setData(next);

    if (!demoMode) {
      const followUpWrites = [
        ...(input.internalNotes ? [update("orders", order.id, { internal_notes: input.internalNotes })] : []),
        ...generatedLogs.map((log) => persist("message_logs", {
          id: log.id,
          order_id: log.orderId,
          order_code: log.orderCode,
          automation_id: log.automationId,
          automation_name: log.automationName,
          channel: log.channel,
          recipient: log.recipient,
          subject: log.subject,
          message: log.message,
          status: log.status,
          created_at: log.createdAt,
        })),
      ];
      const results = await Promise.allSettled(followUpWrites);
      if (results.some((result) => result.status === "rejected")) {
        toast({ message: "Pedido criado, mas uma observação ou automação não pôde ser registrada.", kind: "error", duration: 6000 });
      }
    }

    toast("Pedido criado.");
    return order;
  }, [currentUser.email, demoMode, persist, setData, toast, update]);

  const updateOrderStatus = useCallback(async (id: string, status: OrderStatus) => {
    await commitMutation((current) => {
      const previousOrder = current.orders.find((order) => order.id === id);
      const nextOrders = current.orders.map((order) => order.id === id ? { ...order, status } : order);
      const changedOrder = nextOrders.find((order) => order.id === id);
      const generatedLogs = changedOrder && changedOrder.status !== previousOrder?.status
        ? createMessageLogs(changedOrder, current.messageAutomations)
        : [];
      const couponRedemptions = current.couponRedemptions.map((redemption) => redemption.orderId === id
        ? { ...redemption, status: status === "Cancelado" ? "released" as const : "used" as const }
        : redemption);
      let products = current.products;
      let inventoryMovements = current.inventoryMovements;
      let financialTransactions = current.financialTransactions;
      const changedAt = new Date().toISOString();
      const committedStatuses: OrderStatus[] = ["Pago", "Preparando", "Enviado", "Entregue"];
      const wasCommitted = Boolean(previousOrder && (
        (previousOrder.orderSource ?? "legacy") === "legacy"
        || committedStatuses.includes(previousOrder.status)
      ));
      const shouldCommit = Boolean(previousOrder && committedStatuses.includes(status) && !wasCommitted);

      if (previousOrder && shouldCommit) {
        products = current.products.map((product) => {
          const item = previousOrder.items.find((candidate) => candidate.productId === product.id);
          return item ? { ...product, stock: Math.max(0, product.stock - item.quantity) } : product;
        });
        const sales: InventoryMovement[] = previousOrder.items
          .filter((item) => !inventoryMovements.some((movement) => movement.id === `sale-${id}-${item.productId}`))
          .map((item) => ({
            id: `sale-${id}-${item.productId}`,
            productId: item.productId,
            type: "sale",
            quantity: -item.quantity,
            balanceAfter: products.find((product) => product.id === item.productId)?.stock ?? 0,
            unitCost: item.unitCost,
            referenceType: "order",
            referenceId: id,
            note: `Baixa confirmada do pedido ${previousOrder.code}.`,
            actorEmail: currentUser.email,
            createdAt: changedAt,
          }));
        inventoryMovements = [...sales, ...inventoryMovements];
      }

      if (previousOrder && status === "Cancelado" && previousOrder.status !== "Cancelado" && wasCommitted) {
        products = current.products.map((product) => {
          const item = previousOrder.items.find((candidate) => candidate.productId === product.id);
          return item ? { ...product, stock: product.stock + item.quantity } : product;
        });
        const returns: InventoryMovement[] = previousOrder.items
          .filter((item) => !inventoryMovements.some((movement) => movement.id === `cancel-${id}-${item.productId}`))
          .map((item) => ({
            id: `cancel-${id}-${item.productId}`,
            productId: item.productId,
            type: "return",
            quantity: item.quantity,
            balanceAfter: products.find((product) => product.id === item.productId)?.stock ?? 0,
            unitCost: item.unitCost,
            referenceType: "order",
            referenceId: id,
            note: `Estoque devolvido pelo cancelamento de ${previousOrder.code}.`,
            actorEmail: currentUser.email,
            createdAt: changedAt,
          }));
        inventoryMovements = [...returns, ...inventoryMovements];
        financialTransactions = financialTransactions.map((transaction) => transaction.orderId === id
          ? { ...transaction, status: "cancelled" as const }
          : transaction);
      }

      if (previousOrder && status === "Pago" && previousOrder.status !== "Pago") {
        const cost = previousOrder.items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0);
        const income: FinancialTransaction = { id: `order-income-${id}`, type: "income", status: "paid", description: `Venda ${previousOrder.code}`, amount: previousOrder.total, category: "Vendas", account: "Conta principal", costCenter: "Comercial", dueDate: changedAt.slice(0, 10), paidAt: changedAt, orderId: id, purchaseOrderId: "", recurring: false, notes: "Gerado automaticamente ao marcar o pedido como pago.", createdAt: changedAt };
        const cogs: FinancialTransaction = { id: `order-cogs-${id}`, type: "expense", status: "paid", description: `Custo dos produtos - ${previousOrder.code}`, amount: cost, category: "CMV", account: "Estoque", costCenter: "Operação", dueDate: changedAt.slice(0, 10), paidAt: changedAt, orderId: id, purchaseOrderId: "", recurring: false, notes: "Custo congelado nos itens do pedido.", createdAt: changedAt };
        financialTransactions = [income, ...(cost > 0 ? [cogs] : []), ...financialTransactions.filter((transaction) => transaction.id !== income.id && transaction.id !== cogs.id)];
      }

      return { ...current, products, inventoryMovements, financialTransactions, orders: nextOrders, couponRedemptions, messageLogs: [...generatedLogs, ...current.messageLogs] };
    }, async (next, previous) => {
      const generatedCount = Math.max(0, next.messageLogs.length - previous.messageLogs.length);
      const generatedLogs = next.messageLogs.slice(0, generatedCount);
      if (!supabase) return;
      const { error } = await supabase.rpc("update_tenant_order_status", { p_tenant_id: dataRef.current.tenant.id, p_order_id: id, p_status: status });
      if (!error) return;
      if (error.code !== "PGRST202" && error.code !== "42883") throw new Error(error.message);
      await update("orders", id, { status });
      await Promise.all(generatedLogs.map((log) => persist("message_logs", { id: log.id, order_id: log.orderId, order_code: log.orderCode, automation_id: log.automationId, automation_name: log.automationName, channel: log.channel, recipient: log.recipient, subject: log.subject, message: log.message, status: log.status, created_at: log.createdAt })));
    }, "Status atualizado.");
  }, [commitMutation, currentUser.email, persist, supabase, update]);

  const saveOrderDetails = useCallback(async (id: string, details: { internalNotes: string; trackingCode: string }) => {
    await commitMutation(
      (current) => ({ ...current, orders: current.orders.map((order) => order.id === id ? { ...order, ...details } : order) }),
      () => update("orders", id, { internal_notes: details.internalNotes, tracking_code: details.trackingCode }),
      "Detalhes do pedido salvos.",
    );
  }, [commitMutation, update]);

  const saveSettings = useCallback(async (settings: StoreSettings) => {
    await commitMutation(
      (current) => ({ ...current, settings }),
      () => persist("store_settings", { id: "default", store_name: settings.storeName, logo_url: settings.logoUrl, favicon_url: settings.faviconUrl, whatsapp: settings.whatsapp, order_prefix: settings.orderPrefix, email: settings.email, hours: settings.hours, announcement: settings.announcement, footer_description: settings.footerDescription, primary_color: settings.primaryColor, secondary_color: settings.secondaryColor, background_color: settings.backgroundColor, text_color: settings.textColor, font_family: settings.fontFamily, header_layout: settings.headerLayout, content_width: settings.contentWidth, border_radius: settings.borderRadius, free_shipping_threshold: settings.freeShippingThreshold, shipping_flat: settings.shippingFlat, free_shipping_enabled: settings.freeShippingEnabled, free_shipping_banner_enabled: settings.freeShippingBannerEnabled, free_shipping_banner_eyebrow: settings.freeShippingBannerEyebrow, free_shipping_banner_title: settings.freeShippingBannerTitle, free_shipping_banner_subtitle: settings.freeShippingBannerSubtitle, free_shipping_banner_button_text: settings.freeShippingBannerButtonText, free_shipping_banner_button_link: settings.freeShippingBannerButtonLink, pix_discount: settings.pixDiscount, auto_banner_seconds: settings.autoBannerSeconds, checkout_mode: settings.checkoutMode, whatsapp_message: settings.whatsappMessage }),
      "Configurações salvas.",
    );
  }, [commitMutation, persist]);

  const uploadMedia = useCallback(async (file: File, bucket: "product-media" | "banner-media" | "site-media") => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];
    if (!allowedTypes.includes(file.type)) throw new Error("Use uma imagem JPG, PNG, WebP, GIF ou AVIF.");
    if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");
    if (!supabase) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
    }
    const path = `${dataRef.current.tenant.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }, [supabase]);

  const clearOrders = useCallback(async () => {
    await commitMutation(
      (current) => ({ ...current, orders: [], couponRedemptions: [], messageLogs: [] }),
      async () => {
        if (!supabase) return;
        const { error } = await supabase.from("orders").delete().eq("tenant_id", dataRef.current.tenant.id).neq("id", "");
        if (error) throw new Error(error.message);
      },
      "Pedidos demonstrativos removidos.",
    );
  }, [commitMutation, supabase]);

  const applyTeamResponse = useCallback(async (response: Response) => {
    const payload = await response.json().catch(() => ({})) as { users?: AdminUser[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a operação.");
    if (payload.users) setData((current) => ({ ...current, teamMembers: payload.users ?? current.teamMembers }));
  }, [setData]);

  const refreshTeamMembers = useCallback(async () => {
    if (demoMode) return;
    await applyTeamResponse(await fetch("/api/admin/users", { cache: "no-store" }));
  }, [applyTeamResponse, demoMode]);

  const createAdminUser = useCallback(async (user: AdminUserCreateInput) => {
    if (demoMode) {
      const member: AdminUser = { id: crypto.randomUUID(), fullName: user.fullName, email: user.email, role: user.role, permissions: user.permissions, active: user.active, createdAt: new Date().toISOString(), lastSignInAt: "" };
      setData((current) => ({ ...current, teamMembers: [...current.teamMembers, member] }));
    } else {
      await applyTeamResponse(await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user) }));
    }
    toast("Usuário criado.");
  }, [applyTeamResponse, demoMode, setData, toast]);

  const updateAdminUser = useCallback(async (user: AdminUserUpdateInput) => {
    if (demoMode) {
      setData((current) => ({ ...current, teamMembers: current.teamMembers.map((member) => member.id === user.id ? { ...member, ...user } : member) }));
    } else {
      await applyTeamResponse(await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user) }));
    }
    toast("Acesso atualizado.");
  }, [applyTeamResponse, demoMode, setData, toast]);

  const deleteAdminUser = useCallback(async (id: string) => {
    if (demoMode) {
      setData((current) => ({ ...current, teamMembers: current.teamMembers.filter((member) => member.id !== id) }));
    } else {
      await applyTeamResponse(await fetch(`/api/admin/users?id=${encodeURIComponent(id)}`, { method: "DELETE" }));
    }
    toast("Usuário excluído.");
  }, [applyTeamResponse, demoMode, setData, toast]);

  const resetData = useCallback(() => {
    const next = structuredClone(initialDataRef.current);
    dataRef.current = next;
    setData(next);
  }, []);

  const importData = useCallback((next: StoreData) => {
    const normalized = normalizeAdminStoreData(next, initialDataRef.current);
    dataRef.current = normalized;
    setData(normalized);
  }, []);

  const value = useMemo<AdminDataContextValue>(() => ({
    data,
    demoMode,
    currentUser,
    saveProduct,
    deleteProduct,
    saveBanner,
    deleteBanner,
    saveCategory,
    deleteCategory,
    saveSection,
    savePage,
    deletePage,
    savePageBlock,
    deletePageBlock,
    movePageBlock,
    saveMessageAutomation,
    deleteMessageAutomation,
    saveCoupon,
    deleteCoupon,
    saveCustomer,
    saveCustomerTask,
    deleteCustomerTask,
    saveCustomerContact,
    createOrder,
    saveFinancialTransaction,
    deleteFinancialTransaction,
    recordInventoryMovement,
    saveProductLot,
    saveSupplier,
    savePurchaseOrder,
    receivePurchaseOrder,
    importProducts,
    importStock,
    moveItem,
    reorderItem,
    toggleItem,
    updateOrderStatus,
    saveOrderDetails,
    saveSettings,
    uploadMedia,
    clearOrders,
    refreshTeamMembers,
    createAdminUser,
    updateAdminUser,
    deleteAdminUser,
    resetData,
    importData,
  }), [data, demoMode, currentUser, saveProduct, deleteProduct, saveBanner, deleteBanner, saveCategory, deleteCategory, saveSection, savePage, deletePage, savePageBlock, deletePageBlock, movePageBlock, saveMessageAutomation, deleteMessageAutomation, saveCoupon, deleteCoupon, saveCustomer, saveCustomerTask, deleteCustomerTask, saveCustomerContact, createOrder, saveFinancialTransaction, deleteFinancialTransaction, recordInventoryMovement, saveProductLot, saveSupplier, savePurchaseOrder, receivePurchaseOrder, importProducts, importStock, moveItem, reorderItem, toggleItem, updateOrderStatus, saveOrderDetails, saveSettings, uploadMedia, clearOrders, refreshTeamMembers, createAdminUser, updateAdminUser, deleteAdminUser, resetData, importData]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (!context) throw new Error("useAdminData must be used inside AdminDataProvider");
  return context;
}
