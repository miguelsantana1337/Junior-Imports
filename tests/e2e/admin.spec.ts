import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("autentica no modo local e cadastra um produto", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Boa tarde, Miguel" })).toBeVisible();

  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole("navigation", { name: "Navegação administrativa" }).getByRole("link", { name: "Produtos", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar produto" }).click();
  const modal = page.getByRole("dialog", { name: "Novo produto" });
  await modal.getByLabel("Nome").fill("Produto E2E");
  await modal.getByLabel("Marca").fill("Marca Teste");
  await modal.getByLabel("Preço", { exact: true }).fill("149.90");
  await modal.getByLabel("Preço anterior").fill("169.90");
  await modal.getByLabel("Estoque").fill("7");
  await modal.getByLabel("Descrição").fill("Produto criado pelo fluxo automatizado de teste.");
  await modal.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByRole("cell", { name: "Produto E2E" })).toBeVisible();
});
