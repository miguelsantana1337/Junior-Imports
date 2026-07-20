import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultAdminPreferences,
  adminPreferencesStorageKey,
  normalizeAdminPreferences,
  readAdminPreferences,
  writeAdminPreferences,
} from "./admin-preferences";

describe("preferências do painel", () => {
  beforeEach(() => window.localStorage.clear());

  it("mantém apenas favoritos e visualizações válidos", () => {
    const preferences = normalizeAdminPreferences({
      favoriteHrefs: ["/admin/products", "/admin/products", "https://example.com"],
      tableDensity: "invalid",
      productViews: [{ id: "v1", name: " Ativos ", query: "fone", category: "all", visibility: "active", createdAt: "2026-07-18T00:00:00.000Z" }, { id: 2 }],
    });

    expect(preferences.favoriteHrefs).toEqual(["/admin/products"]);
    expect(preferences.tableDensity).toBe("comfortable");
    expect(preferences.productViews).toHaveLength(1);
    expect(preferences.productViews[0]?.name).toBe("Ativos");
    expect(preferences.mutedNotificationCategories).toEqual([]);
    expect(preferences.includeInformativeNotifications).toBe(false);
  });

  it("persiste preferências separadamente por usuário", () => {
    writeAdminPreferences("miguel", { ...defaultAdminPreferences, favoriteHrefs: ["/admin/data"], tableDensity: "compact", mutedNotificationCategories: ["marketing"] });
    writeAdminPreferences("junior", { ...defaultAdminPreferences, favoriteHrefs: ["/admin/products"], tableDensity: "comfortable" });

    expect(readAdminPreferences("miguel").favoriteHrefs).toEqual(["/admin/data"]);
    expect(readAdminPreferences("miguel").mutedNotificationCategories).toEqual(["marketing"]);
    expect(readAdminPreferences("junior").favoriteHrefs).toEqual(["/admin/products"]);
    expect(window.localStorage.getItem(adminPreferencesStorageKey("miguel"))).toContain("compact");
  });

  it("recupera o padrão quando o armazenamento está corrompido", () => {
    window.localStorage.setItem(adminPreferencesStorageKey("miguel"), "{invalid");
    expect(readAdminPreferences("miguel")).toEqual(defaultAdminPreferences);
  });
});
