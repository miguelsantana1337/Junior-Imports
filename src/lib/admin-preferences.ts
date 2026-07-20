export type AdminTableDensity = "comfortable" | "compact";
export type AdminNotificationCategory = "inventory" | "orders" | "crm" | "purchasing" | "collaboration" | "cashback" | "marketing" | "security" | "system";

export interface SavedProductView {
  id: string;
  name: string;
  query: string;
  category: string;
  visibility: string;
  createdAt: string;
}

export interface AdminPreferences {
  favoriteHrefs: string[];
  tableDensity: AdminTableDensity;
  productViews: SavedProductView[];
  mutedNotificationCategories: AdminNotificationCategory[];
  includeInformativeNotifications: boolean;
}

const storagePrefix = "junior-imports:admin-preferences:v1";

export const defaultAdminPreferences: AdminPreferences = {
  favoriteHrefs: [],
  tableDensity: "comfortable",
  productViews: [],
  mutedNotificationCategories: [],
  includeInformativeNotifications: false,
};

export const adminNotificationCategories: AdminNotificationCategory[] = [
  "inventory",
  "orders",
  "crm",
  "purchasing",
  "collaboration",
  "cashback",
  "marketing",
  "security",
  "system",
];

export function adminPreferencesStorageKey(userId: string) {
  return `${storagePrefix}:${userId || "anonymous"}`;
}

function isAdminHref(value: unknown): value is string {
  return typeof value === "string" && /^\/admin(?:[/?#]|$)/.test(value);
}

function normalizeSavedProductView(value: unknown): SavedProductView | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<SavedProductView>;
  if (typeof candidate.id !== "string" || typeof candidate.name !== "string" || !candidate.name.trim()) return null;
  return {
    id: candidate.id,
    name: candidate.name.trim().slice(0, 48),
    query: typeof candidate.query === "string" ? candidate.query.slice(0, 120) : "",
    category: typeof candidate.category === "string" ? candidate.category : "all",
    visibility: ["all", "active", "hidden"].includes(candidate.visibility ?? "") ? candidate.visibility! : "all",
    createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt : new Date(0).toISOString(),
  };
}

export function normalizeAdminPreferences(value: unknown): AdminPreferences {
  if (!value || typeof value !== "object") return { ...defaultAdminPreferences };
  const candidate = value as Partial<AdminPreferences>;
  const favoriteHrefs = Array.isArray(candidate.favoriteHrefs)
    ? [...new Set(candidate.favoriteHrefs.filter(isAdminHref))].slice(0, 16)
    : [];
  const productViews = Array.isArray(candidate.productViews)
    ? candidate.productViews.map(normalizeSavedProductView).filter((view): view is SavedProductView => Boolean(view)).slice(0, 12)
    : [];
  const mutedNotificationCategories = Array.isArray(candidate.mutedNotificationCategories)
    ? [...new Set(candidate.mutedNotificationCategories.filter((category): category is AdminNotificationCategory => adminNotificationCategories.includes(category as AdminNotificationCategory)))]
    : [];

  return {
    favoriteHrefs,
    tableDensity: candidate.tableDensity === "compact" ? "compact" : "comfortable",
    productViews,
    mutedNotificationCategories,
    includeInformativeNotifications: candidate.includeInformativeNotifications === true,
  };
}

export function readAdminPreferences(userId: string, storage: Pick<Storage, "getItem"> = window.localStorage) {
  try {
    const stored = storage.getItem(adminPreferencesStorageKey(userId));
    return stored ? normalizeAdminPreferences(JSON.parse(stored)) : { ...defaultAdminPreferences };
  } catch {
    return { ...defaultAdminPreferences };
  }
}

export function writeAdminPreferences(userId: string, preferences: AdminPreferences, storage: Pick<Storage, "setItem"> = window.localStorage) {
  const normalized = normalizeAdminPreferences(preferences);
  storage.setItem(adminPreferencesStorageKey(userId), JSON.stringify(normalized));
  return normalized;
}
