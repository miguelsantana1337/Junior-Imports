import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("abre uma pagina individual de produto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PROJETO DEMONSTRATIVO").first()).toBeVisible();
  await page.getByRole("link", { name: "Ver detalhes de T.G. 15" }).first().click();
  await expect(page).toHaveURL(/\/produtos\/t-g-15$/);
  await expect(page.getByRole("heading", { name: "T.G. 15" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Adicionar ao carrinho/ })).toBeVisible();
});

test("conclui carrinho, cupom e checkout demonstrativo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adicionar T.G. 15 ao carrinho" }).first().click();
  const cart = page.getByRole("dialog", { name: "Carrinho" });
  await expect(cart).toBeVisible();
  await cart.getByLabel("Cupom de desconto").fill("JUNIOR10");
  await cart.getByRole("button", { name: "Aplicar" }).click();
  await expect(cart.getByText("Cupom JUNIOR10 aplicado.")).toBeVisible();
  await cart.getByRole("link", { name: "Ir para o checkout" }).click();

  await page.getByLabel("Nome completo").fill("Cliente Demonstracao");
  await page.getByRole("textbox", { name: "WhatsApp", exact: true }).fill("(31) 99999-9999");
  await page.getByLabel("E-mail").fill("cliente@exemplo.com");
  await page.getByLabel("CEP").fill("35160-000");
  await page.getByLabel("Cidade").fill("Ipatinga");
  await page.getByLabel("Estado").selectOption("MG");
  await page.getByLabel("Endereço").fill("Rua Exemplo");
  await page.getByLabel("Número").fill("100");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Criar pedido demonstrativo" }).click();

  await expect(page).toHaveURL(/\/pedidos\/JI-\d+$/);
  await expect(page.getByRole("heading", { name: "Pedido demonstrativo criado." })).toBeVisible();
  await expect(page.getByText("Nenhuma cobrança, separação ou entrega foi iniciada.")).toBeVisible();
});
