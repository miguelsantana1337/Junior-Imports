import path from "node:path";
import { expect, test } from "@playwright/test";

const auditDir = path.join(process.cwd(), "docs", "ux-audit", "before");

test("captura a vitrine atual em desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await page.screenshot({ path: path.join(auditDir, "01-storefront-desktop.png"), fullPage: false });
});

test("captura o painel atual em desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.screenshot({ path: path.join(auditDir, "02-admin-desktop.png"), fullPage: false });
  await page.getByRole("navigation", { name: "Navegação administrativa" }).getByRole("link", { name: "Banners", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Banners rotativos", level: 1 })).toBeVisible();
  await page.screenshot({ path: path.join(auditDir, "03-banners-desktop.png"), fullPage: false });
});

test("captura catálogo e carrinho atuais no celular", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("main")).toBeVisible();
  await page.screenshot({ path: path.join(auditDir, "04-storefront-mobile.png"), fullPage: false });
  await page.locator("#catalogo").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Adicionar .* ao carrinho/ }).first().click();
  await expect(page.getByRole("dialog", { name: "Carrinho" })).toBeVisible();
  await page.screenshot({ path: path.join(auditDir, "05-cart-mobile.png"), fullPage: false });
});
