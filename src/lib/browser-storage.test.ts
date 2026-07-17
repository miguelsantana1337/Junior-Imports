import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAdminSensitiveBrowserStorage,
  purgeLegacyAuthLocalStorage,
  readSensitiveSessionValue,
  writeSensitiveSessionValue,
} from "./browser-storage";

describe("armazenamento sensível no navegador", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("migra um valor legado para a sessão e apaga a cópia persistente", () => {
    window.localStorage.setItem("tenant:cart:v1", '[{"productId":"p1"}]');

    expect(readSensitiveSessionValue("tenant:cart:v1")).toBe(
      '[{"productId":"p1"}]',
    );
    expect(window.localStorage.getItem("tenant:cart:v1")).toBeNull();
    expect(window.sessionStorage.getItem("tenant:cart:v1")).toBe(
      '[{"productId":"p1"}]',
    );
  });

  it("grava dados sensíveis somente durante a sessão da aba", () => {
    writeSensitiveSessionValue("tenant:favorites:v1", '["p1"]');

    expect(window.sessionStorage.getItem("tenant:favorites:v1")).toBe('["p1"]');
    expect(window.localStorage.getItem("tenant:favorites:v1")).toBeNull();
  });

  it("remove tokens legados do Supabase mantidos no localStorage", () => {
    window.localStorage.setItem("sb-kxvaifkqrlkfrqphfpaf-auth-token", "token");
    window.localStorage.setItem("sb-kxvaifkqrlkfrqphfpaf-auth-token.0", "chunk");
    window.localStorage.setItem("junior-imports:admin-theme", "dark");

    purgeLegacyAuthLocalStorage();

    expect(window.localStorage.getItem("sb-kxvaifkqrlkfrqphfpaf-auth-token")).toBeNull();
    expect(window.localStorage.getItem("sb-kxvaifkqrlkfrqphfpaf-auth-token.0")).toBeNull();
    expect(window.localStorage.getItem("junior-imports:admin-theme")).toBe("dark");
  });

  it("limpa rascunhos e dados administrativos ao sair", () => {
    window.sessionStorage.setItem("tenant:store-data:v1", "{}");
    window.sessionStorage.setItem("junior-imports:product-draft:new", "{}");
    window.localStorage.setItem("junior-imports:admin-sidebar", "collapsed");

    clearAdminSensitiveBrowserStorage();

    expect(window.sessionStorage.getItem("tenant:store-data:v1")).toBeNull();
    expect(window.sessionStorage.getItem("junior-imports:product-draft:new")).toBeNull();
    expect(window.localStorage.getItem("junior-imports:admin-sidebar")).toBe("collapsed");
  });
});
