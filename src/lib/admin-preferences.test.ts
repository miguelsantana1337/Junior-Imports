import { beforeEach, describe, expect, it } from "vitest";
import {
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
  });

  it("persiste preferências separadamente por usuário", () => {
    writeAdminPreferences("miguel", { favoriteHrefs: ["/admin/data"], tableDensity: "compact", productViews: [] });
    writeAdminPreferences("junior", { favoriteHrefs: ["/admin/products"], tableDensity: "comfortable", productViews: [] });

    expect(readAdminPreferences("miguel").favoriteHrefs).toEqual(["/admin/data"]);
    expect(readAdminPreferences("junior").favoriteHrefs).toEqual(["/admin/products"]);
    expect(window.localStorage.getItem(adminPreferencesStorageKey("miguel"))).toContain("compact");
  });

  it("recupera o padrão quando o armazenamento está corrompido", () => {
    window.localStorage.setItem(adminPreferencesStorageKey("miguel"), "{invalid");
    expect(readAdminPreferences("miguel")).toEqual({ favoriteHrefs: [], tableDensity: "comfortable", productViews: [] });
  });
});
