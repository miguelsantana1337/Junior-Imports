import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function openSection(page: Page, name: string) {
  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  if (await menuButton.isVisible()) await menuButton.click();
  await page.getByRole("navigation", { name: "Navegação administrativa" }).getByRole("link", { name, exact: true }).click();
}

test("autentica no modo local e cadastra um produto", async ({ page }) => {
  await login(page);
  await expect(page.getByRole("heading", { name: "Boa tarde, Miguel" })).toBeVisible();

  await openSection(page, "Produtos");
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

test("cria uma pagina e um container personalizado", async ({ page }) => {
  await login(page);
  await openSection(page, "Editor da loja");
  await page.getByRole("button", { name: "Nova página" }).first().click();
  const pageModal = page.getByRole("dialog", { name: "Nova página" });
  await pageModal.getByLabel("Nome interno").fill("Guia de compra");
  await pageModal.getByLabel("Endereço da página").fill("guia-de-compra");
  await pageModal.getByLabel("Título público").fill("Guia de compra");
  await pageModal.getByLabel("Descrição para busca").fill("Conteúdo demonstrativo para ajudar clientes.");
  await pageModal.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByRole("button", { name: /Guia de compra/ })).toBeVisible();

  await page.getByRole("button", { name: "Novo container" }).click();
  const blockModal = page.getByRole("dialog", { name: "Novo container" });
  await blockModal.getByLabel("Tipo de conteúdo").selectOption("cta");
  await blockModal.getByLabel("Nome interno").fill("Chamada principal");
  await blockModal.getByRole("textbox", { name: "Título", exact: true }).fill("Encontre o produto ideal.");
  await blockModal.getByRole("textbox", { name: "Texto", exact: true }).fill("Uma chamada configurada pelo editor modular.");
  await blockModal.getByRole("textbox", { name: "Texto do botão", exact: true }).fill("Ver catálogo");
  await blockModal.getByLabel("Link do botão").fill("/#catalogo");
  await blockModal.getByRole("button", { name: "Salvar container" }).click();
  await expect(page.getByText("Chamada principal", { exact: true })).toBeVisible();
});

test("configura mensagem automatica e registra o disparo", async ({ page }) => {
  await login(page);
  await openSection(page, "Mensagens");
  await page.getByRole("button", { name: "Nova automação" }).first().click();
  const automationModal = page.getByRole("dialog", { name: "Nova automação" });
  await automationModal.getByLabel("Nome da automação").fill("Aviso de preparação");
  await automationModal.getByLabel("Status que dispara").selectOption("Preparando");
  await automationModal.getByLabel("Mensagem").fill("Olá, {{cliente}}! O pedido {{pedido}} está sendo preparado.");
  await automationModal.getByRole("button", { name: "Salvar automação" }).click();
  await expect(page.getByText("Aviso de preparação", { exact: true })).toBeVisible();

  await openSection(page, "Pedidos");
  await page.getByRole("button", { name: "Abrir", exact: true }).first().click();
  const orderModal = page.getByRole("dialog");
  await orderModal.getByLabel("Status").selectOption("Preparando");
  await orderModal.getByRole("button", { name: "Atualizar e automatizar" }).click();
  await openSection(page, "Mensagens");
  await expect(page.getByRole("cell", { name: "Aviso de preparação" })).toBeVisible();
});
