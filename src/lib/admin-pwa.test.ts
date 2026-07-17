import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/admin-manifest.webmanifest"), "utf8"),
) as {
  id: string;
  start_url: string;
  scope: string;
  display: string;
  icons: Array<{ src: string; sizes: string; purpose?: string }>;
  shortcuts: Array<{ url: string }>;
};
const serviceWorker = readFileSync(
  resolve(process.cwd(), "public/admin-sw.js"),
  "utf8",
);
const nextConfig = readFileSync(
  resolve(process.cwd(), "next.config.ts"),
  "utf8",
);

describe("PWA do painel administrativo", () => {
  it("mantém instalação e atalhos restritos ao painel", () => {
    expect(manifest.id).toBe("/admin");
    expect(manifest.start_url).toMatch(/^\/admin/);
    expect(manifest.scope).toBe("/admin");
    expect(
      new URL(manifest.start_url, "https://junior-imports.vercel.app").pathname
        .startsWith(manifest.scope),
    ).toBe(true);
    expect(manifest.display).toBe("standalone");
    expect(manifest.shortcuts.every((shortcut) => shortcut.url.startsWith("/admin"))).toBe(true);
  });

  it("oferece ícones instaláveis nos tamanhos essenciais", () => {
    expect(manifest.icons.some((icon) => icon.sizes === "192x192")).toBe(true);
    expect(manifest.icons.some((icon) => icon.sizes === "512x512")).toBe(true);
    expect(
      manifest.icons.some(
        (icon) =>
          icon.purpose === "maskable" &&
          icon.src === "/pwa/admin-icon-maskable-512.png",
      ),
    ).toBe(true);

    for (const file of [
      "public/pwa/admin-icon-192.png",
      "public/pwa/admin-icon-512.png",
      "public/pwa/admin-icon-maskable-512.png",
      "public/pwa/admin-apple-touch-icon.png",
    ]) {
      const path = resolve(process.cwd(), file);
      expect(existsSync(path)).toBe(true);
      expect(statSync(path).size).toBeGreaterThan(1_000);
    }
  });

  it("não coloca páginas, APIs ou respostas RSC administrativas no cache", () => {
    expect(serviceWorker).toContain('fetch(request, { cache: "no-store" })');
    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).toContain('url.searchParams.has("_rsc")');
    expect(serviceWorker).toContain('request.headers.has("RSC")');
    expect(serviceWorker).toContain('url.pathname.startsWith("/_next/static/")');
  });

  it("serve o worker sem cache e limita seu escopo ao admin", () => {
    expect(nextConfig).toContain('{ key: "Service-Worker-Allowed", value: "/admin" }');
    expect(nextConfig).toContain('source: "/admin-sw.js"');
    expect(nextConfig).toContain('value: "no-cache, no-store, must-revalidate"');
  });
});
