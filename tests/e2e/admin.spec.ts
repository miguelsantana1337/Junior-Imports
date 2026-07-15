import path from "node:path";
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
  await expect(page.getByRole("heading", { name: /^(Bom dia|Boa tarde|Boa noite),/ })).toBeVisible();

  await openSection(page, "Produtos");
  await page.getByRole("link", { name: "Adicionar produto" }).click();
  await expect(page).toHaveURL(/\/admin\/products\/new$/);
  await page.getByLabel("Nome do produto").fill("Produto E2E");
  await page.getByLabel("Marca").fill("Marca Teste");
  await page.getByLabel("Descrição").fill("Produto criado pelo fluxo automatizado de teste.");
  await page.getByRole("button", { name: /Continuar/ }).first().click();

  await expect(page.getByRole("heading", { name: "Fotos do produto" })).toBeVisible();
  await page.locator('input[type="file"]').first().setInputFiles([
    path.join(process.cwd(), "public", "demo-products", "tg15-cover.png"),
    path.join(process.cwd(), "public", "demo-products", "tg15-side.png"),
  ]);
  await expect(page.getByText("2/10")).toBeVisible();
  await page.getByRole("button", { name: "Usar como capa" }).click();
  await page.getByRole("button", { name: /Continuar/ }).first().click();

  await page.getByLabel("Preço de venda (R$)").fill("149.90");
  await page.getByLabel("Preço anterior (R$)").fill("169.90");
  await page.getByLabel("Quantidade em estoque").fill("7");
  await page.getByRole("button", { name: /Continuar/ }).first().click();
  await page.getByRole("button", { name: /Salvar produto/ }).first().click();
  await expect(page.getByRole("status").filter({ hasText: "Produto salvo." })).toBeVisible();
  await expect(page.getByText("Produto E2E", { exact: true }).first()).toBeVisible();
});

test("cria uma pagina e um container personalizado", async ({ page }) => {
  await login(page);
  await openSection(page, "Editor da loja");
  await page.getByRole("button", { name: "Nova página" }).first().click();
  const pageModal = page.getByRole("dialog", { name: "Nova página" });
  await expect(pageModal).toBeVisible();
  await pageModal.getByLabel("Nome interno").fill("Guia de compra");
  await pageModal.getByLabel("Endereço da página").fill("guia-de-compra");
  await pageModal.getByLabel("Título público").fill("Guia de compra");
  await pageModal.getByLabel("Descrição da prévia do link").fill("Conteúdo demonstrativo para ajudar clientes.");
  await pageModal.getByRole("button", { name: "Salvar página" }).click();
  await expect(page.getByRole("button", { name: /Guia de compra/ })).toBeVisible();

  await page.getByRole("button", { name: "Novo container" }).click();
  const blockModal = page.getByRole("dialog", { name: "Novo container" });
  await expect(blockModal).toBeVisible();
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
  const orderButtonName = (page.viewportSize()?.width ?? 1280) < 760 ? "Abrir pedido" : "Abrir";
  const orderButton = page.getByRole("button", { name: orderButtonName, exact: true }).first();
  await expect(orderButton).toBeVisible();
  await orderButton.click();
  const orderModal = page.getByRole("dialog");
  await orderModal.getByLabel("Status").selectOption("Preparando");
  await orderModal.getByRole("button", { name: "Atualizar e automatizar" }).click();
  await openSection(page, "Mensagens");
  await expect(page.getByRole("cell", { name: "Aviso de preparação" })).toBeVisible();
});

test("cria usuario e personaliza suas permissoes", async ({ page }) => {
  await login(page);
  await openSection(page, "Usuários");
  await page.getByRole("button", { name: "Novo usuário", exact: true }).click();
  const modal = page.getByRole("dialog", { name: "Novo usuário" });
  await modal.getByLabel("Nome completo").fill("Operador E2E");
  await modal.getByLabel("E-mail").fill("operador-e2e@exemplo.com");
  await modal.getByLabel("Senha temporária").fill("senha-e2e-123");
  await modal.getByLabel("Cargo").selectOption("support");
  await modal.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText("Operador E2E", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Editar Operador E2E" }).click();
  const editModal = page.getByRole("dialog", { name: "Editar usuário" });
  await editModal.getByLabel("Acesso ativo").uncheck();
  await editModal.getByRole("button", { name: "Salvar acesso" }).click();
  await expect(page.getByText("Suspenso", { exact: true })).toBeVisible();
});

test("gerencia CRM, limite de cupom, frete e estoque por planilha", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await openSection(page, "Clientes");
  await expect(page.getByLabel("Buscar clientes")).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Buscar clientes").fill("cliente1@exemplo.com");
  const customerAction = (page.viewportSize()?.width ?? 1280) < 820 ? "Ver cliente" : "Abrir";
  await page.getByRole("button", { name: customerAction, exact: true }).click();
  const customerModal = page.getByRole("dialog", { name: /Cliente demonstração/i });
  await customerModal.getByLabel("Etiquetas").fill("recompra, indicação");
  await customerModal.getByRole("button", { name: "Salvar cliente" }).click();

  await openSection(page, "Cupons");
  await page.getByRole("button", { name: /^Editar / }).first().click();
  const couponModal = page.getByRole("dialog", { name: "Editar cupom" });
  await couponModal.getByLabel("Limite por cliente").fill("2");
  await couponModal.getByRole("button", { name: "Salvar cupom" }).click();
  await expect(page.getByRole("cell").filter({ hasText: /2 usos/ }).first()).toBeVisible();

  await openSection(page, "Produtos");
  const skuText = await ((page.viewportSize()?.width ?? 1280) < 760
    ? page.locator(".admin-mobile-cards .admin-product-cell small").first()
    : page.locator(".admin-products-desktop .admin-product-cell small").first()).textContent();
  const sku = skuText?.split(" · ")[0]?.trim();
  expect(sku).toBeTruthy();

  await openSection(page, "Importar planilha");
  await page.getByRole("button", { name: "Atualizar estoque" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "estoque-e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`sku;quantidade\n${sku};8`),
  });
  await expect(page.getByText("Pronto para importar", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar 1 linha" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Estoque de 1 produto atualizado." })).toBeVisible();

  await openSection(page, "Configurações");
  await page.getByLabel("Frete grátis acima de").fill("777");
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Configurações salvas." })).toBeVisible();
  if ((page.viewportSize()?.width ?? 1280) <= 900) await page.getByRole("button", { name: "Abrir menu" }).click();
  const storeLink = (page.viewportSize()?.width ?? 1280) <= 900
    ? page.locator(".admin-sidebar-actions a").first()
    : page.locator("a.admin-view-store");
  await storeLink.evaluate((element) => element.removeAttribute("target"));
  await storeLink.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText(/Frete grátis acima de R\$\s*777,00/).first()).toBeVisible();
});
