import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("e2e-storage-cleared")) return;
    window.localStorage.clear();
    window.sessionStorage.setItem("e2e-storage-cleared", "true");
  });
});

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 20_000 });
}

async function openSection(page: Page, name: string) {
  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  if (await menuButton.isVisible()) await menuButton.click();
  const navigation = page.getByRole("navigation", { name: "Navegação administrativa" });
  const link = navigation.getByRole("link", { name, exact: true });
  if (!await link.isVisible()) {
    const groupBySection: Record<string, string> = {
      Hoje: "Hoje",
      Pedidos: "Operação",
      "Carrinhos abandonados": "Operação",
      Clientes: "Operação",
      "Tarefas e contatos": "Operação",
      "Caixa e resultados": "Gestão",
      "Estoque e lotes": "Gestão",
      "Relatórios e exportações": "Gestão",
      "Editor da loja": "Loja",
      Produtos: "Loja",
      Categorias: "Loja",
      Cupons: "Marketing",
      "Campanhas e automações": "Marketing",
      "Acessos e permissões": "Administração",
      "Segurança e MFA": "Administração",
      "Loja, frete e atendimento": "Administração",
      "Backup e auditoria": "Administração",
    };
    const group = groupBySection[name];
    if (group) await navigation.getByRole("button", { name: group, exact: true }).click();
  }
  await link.click();
}

test("carrega o painel sem falhas críticas de hidratação", async ({ page }) => {
  const runtimeIssues: string[] = [];
  page.on("pageerror", (error) => runtimeIssues.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeIssues.push(message.text());
  });

  await login(page);
  await page.goto("/admin/collaboration");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Prioridades de hoje" })).toBeVisible();

  const criticalIssues = runtimeIssues.filter((issue) =>
    /hydration|uncaught|typeerror|referenceerror|script tag/i.test(issue),
  );
  expect(criticalIssues).toEqual([]);
});

test("centraliza alertas e preferências de notificações", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /Notificações/ }).click();

  const center = page.getByRole("dialog", { name: "Central de notificações" });
  await expect(center).toBeVisible();
  await expect(center.getByText("Central de alertas", { exact: true })).toBeVisible();
  await expect(center.getByRole("button", { name: /Importantes/ })).toBeVisible();
  await expect(center.getByRole("button", { name: /Todas/ })).toBeVisible();

  await center.getByRole("button", { name: "Configurar notificações" }).click();
  await expect(center.getByText("Preferências individuais", { exact: true })).toBeVisible();
  await expect(center.getByRole("checkbox", { name: /Estoque/ })).toBeChecked();
  await expect(center.getByRole("checkbox", { name: /Segurança/ })).toBeChecked();
});

test("torna o período global claro e permite escolher datas", async ({ page }) => {
  await login(page);

  const menuButton = page.getByRole("button", { name: "Abrir menu" });
  if (await menuButton.isVisible()) await menuButton.click();

  const trigger = page.getByRole("button", { name: /Dados exibidos/ });
  await expect(trigger).toContainText("Últimos 30 dias");
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: "Escolher período dos dados" });
  await expect(dialog.getByText("Qual período deseja analisar?")).toBeVisible();
  await expect(dialog.getByText("Este filtro atualiza os números de todas as telas do painel.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: /Últimos 15 dias/ })).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await dialog.getByRole("button", { name: /Últimos 15 dias/ }).click();
  await expect(trigger).toContainText("Últimos 15 dias");

  await trigger.click();
  await dialog.getByLabel("Data inicial").fill("2026-08-10");
  await dialog.getByLabel("Data final").fill("2026-08-20");
  await dialog.getByRole("button", { name: "Aplicar período" }).click();

  await expect(trigger).toContainText("Período personalizado");
  await expect(trigger).toHaveAttribute("title", /10\/08\/2026 a 20\/08\/2026/);
});

test("instala o painel como PWA sem armazenar páginas administrativas", async ({ page, request }) => {
  await login(page);

  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/admin-manifest.webmanifest",
  );
  const installButton = page.getByRole("button", { name: "Instalar painel como aplicativo" });
  if ((page.viewportSize()?.width ?? 1280) <= 640) await expect(installButton).toBeHidden();
  else expect(await installButton.count()).toBeLessThanOrEqual(1);

  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration("/admin");
    return registration?.scope.endsWith("/admin") ?? false;
  })).toBe(true);
  await expect.poll(() => page.evaluate(
    () => navigator.serviceWorker.controller?.scriptURL.endsWith("/admin-sw.js") ?? false,
  )).toBe(true);

  const cachedAdminPages = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls = (await Promise.all(
      keys.map(async (key) => (await caches.open(key)).keys()),
    )).flat().map((entry) => new URL(entry.url).pathname);
    return urls.filter((pathname) => pathname === "/admin" || pathname.startsWith("/admin/"));
  });
  expect(cachedAdminPages).toEqual([]);

  const manifestResponse = await request.get("/admin-manifest.webmanifest");
  expect(manifestResponse.ok()).toBe(true);
  expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await manifestResponse.json();
  expect(manifest.scope).toBe("/admin");
  expect(manifest.start_url).toMatch(/^\/admin/);
});

test("abre o gerenciamento de MFA com troca segura de dispositivo", async ({ page }) => {
  await login(page);
  await page.goto("/admin/security");

  await expect(page.getByRole("heading", { name: "Segurança e MFA" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Seus acessos em duas etapas, sob controle." })).toBeVisible();
  await expect(page.getByText("Cadastre o celular novo", { exact: true })).toBeVisible();
  await expect(page.getByText("Confirme e teste o acesso", { exact: true })).toBeVisible();
  await expect(page.getByText("Remova o celular antigo", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Adicionar autenticador" })).toBeDisabled();
});

test("exibe o backup completo protegido por MFA na central de dados", async ({ page }) => {
  await login(page);
  await page.goto("/admin/data");

  await expect(page.getByRole("heading", { name: "Backup e manutenção" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Backup completo" })).toBeVisible();
  await expect(page.getByText("Gera um pacote criptografado com dados e mídias do Supabase")).toBeVisible();
  await expect(page.getByRole("button", { name: "Criar backup agora" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "Exportar resumo JSON" })).toBeVisible();
});

test("alterna e mantém o modo escuro do painel", async ({ page }) => {
  await login(page);

  const html = page.locator("html");
  const darkModeButton = page.getByRole("button", { name: "Ativar modo escuro" });
  await expect(darkModeButton).toBeVisible();
  await darkModeButton.click();

  await expect(html).toHaveAttribute("data-admin-theme", "dark");
  await expect(page.locator(".admin-main-next")).toHaveCSS("background-color", "rgb(9, 17, 30)");
  await expect(page.getByRole("button", { name: "Ativar modo claro" })).toBeVisible();

  await page.reload();
  await expect(html).toHaveAttribute("data-admin-theme", "dark");
  await page.getByRole("button", { name: "Ativar modo claro" }).click();
  await expect(html).toHaveAttribute("data-admin-theme", "light");
});

test("recolhe o menu lateral e mantém os indicadores sem sobreposição", async ({ page }) => {
  test.skip((page.viewportSize()?.width ?? 0) <= 900, "O recolhimento é exclusivo do painel em desktop.");
  await login(page);

  const revenueValue = page.locator(".admin-command-stats article").nth(1).locator("strong");
  const productsCard = page.locator(".admin-command-stats article").nth(2);
  const revenueBox = await revenueValue.boundingBox();
  const productsBox = await productsCard.boundingBox();
  expect(revenueBox).not.toBeNull();
  expect(productsBox).not.toBeNull();
  if (revenueBox && productsBox && Math.abs(revenueBox.y - productsBox.y) < productsBox.height) {
    expect(revenueBox.x + revenueBox.width).toBeLessThanOrEqual(productsBox.x);
  }

  await page.getByRole("button", { name: "Recolher menu lateral" }).click();
  await expect(page.locator(".admin-shell-next")).toHaveClass(/is-collapsed/);
  await expect(page.getByRole("button", { name: "Expandir menu lateral" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("junior-imports:admin-sidebar"))).toBe("collapsed");
  await page.getByRole("button", { name: "Expandir menu lateral" }).click();
  await expect(page.locator(".admin-shell-next")).not.toHaveClass(/is-collapsed/);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("junior-imports:admin-sidebar"))).toBe("expanded");
});

test("cria um pedido manual e reserva o estoque", async ({ page }) => {
  await login(page);
  await openSection(page, "Pedidos");
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();

  const modal = page.getByRole("dialog", { name: "Criar pedido" });
  await modal.getByLabel("Nome completo do cliente").fill("Cliente Pedido Manual");
  await modal.getByLabel("WhatsApp do cliente").fill("(31) 99999-1122");
  await modal.getByLabel("E-mail do cliente").fill("pedido.manual@exemplo.com");
  const productSearch = modal.getByRole("combobox", { name: "Produto 1", exact: true });
  await productSearch.fill("Organizador semanal premium");
  await modal.getByRole("option", { name: /Organizador semanal premium/ }).click();
  await expect(productSearch).toHaveValue("Organizador semanal premium");
  await modal.getByLabel("Quantidade do produto 1").fill("1");
  await modal.getByLabel("Forma de pagamento").selectOption("Pix");
  await modal.getByRole("button", { name: "Criar pedido e reservar estoque" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Pedido criado." })).toBeVisible();
  const detail = page.getByRole("dialog", { name: /Pedido / });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Cliente Pedido Manual", { exact: true })).toBeVisible();
});

test("ajusta o financeiro e arquiva um pedido sem apagar o histórico", async ({ page }) => {
  await login(page);
  await openSection(page, "Pedidos");
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();

  const creation = page.getByRole("dialog", { name: "Criar pedido" });
  await creation.getByLabel("Nome completo do cliente").fill("Cliente Controle Financeiro");
  await creation.getByLabel("WhatsApp do cliente").fill("(31) 99999-3344");
  await creation.getByLabel("E-mail do cliente").fill("financeiro.pedido@exemplo.com");
  const productSearch = creation.getByRole("combobox", { name: "Produto 1", exact: true });
  await productSearch.fill("Organizador semanal premium");
  await creation.getByRole("option", { name: /Organizador semanal premium/ }).click();
  await creation.getByRole("button", { name: "Criar pedido e reservar estoque" }).click();

  let detail = page.getByRole("dialog", { name: /Pedido / });
  const orderCode = (await detail.locator("h2").textContent())!;
  await detail.getByLabel("Valor financeiro confirmado").fill("111.50");
  await detail.getByLabel("Motivo da alteração financeira").fill("Valor renegociado no atendimento");
  await detail.getByRole("button", { name: "Registrar ajuste" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Valor financeiro atualizado" })).toBeVisible();
  await expect(detail.getByText("R$ 111,50", { exact: true }).first()).toBeVisible();

  await detail.getByRole("button", { name: "Registrar pagamento" }).click();
  await detail.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(detail.getByText("Pedido quitado", { exact: true })).toBeVisible();
  await detail.getByLabel("Situação do pedido").selectOption("Entregue");
  await detail.getByRole("button", { name: "Revisar alteração" }).click();
  await detail.getByRole("button", { name: "Confirmar alteração" }).click();
  await expect(detail).toBeHidden();

  await page.getByLabel("Buscar pedidos").fill(orderCode);
  if ((page.viewportSize()?.width ?? 1280) <= 760) {
    await page.getByRole("button", { name: `Abrir pedido ${orderCode}` }).click();
  } else {
    const orderRow = page.locator("tr").filter({ hasText: orderCode });
    await orderRow.getByRole("button", { name: "Abrir", exact: false }).click();
  }
  detail = page.getByRole("dialog", { name: `Pedido ${orderCode}` });
  await detail.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(detail).toBeHidden();
  await expect(page.getByText(orderCode, { exact: true })).toHaveCount(0);

  await page.getByRole("tab", { name: /Arquivados/ }).click();
  const archivedList = (page.viewportSize()?.width ?? 1280) <= 760
    ? page.locator(".admin-mobile-cards")
    : page.locator(".admin-orders-desktop");
  await expect(archivedList.getByText(orderCode, { exact: true })).toBeVisible();
  await archivedList.getByRole("button", { name: /Abrir/ }).click();
  detail = page.getByRole("dialog", { name: `Pedido ${orderCode}` });
  await expect(detail.getByText("Fora da fila operacional", { exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Restaurar", exact: true }).click();
  await expect(detail).toBeHidden();
});

test("registra um pedido pago em duas partes e quita somente no saldo final", async ({ page }) => {
  await login(page);
  await openSection(page, "Pedidos");
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();

  const creation = page.getByRole("dialog", { name: "Criar pedido" });
  await creation.getByLabel("Nome completo do cliente").fill("Cliente Pagamento Parcelado");
  await creation.getByLabel("WhatsApp do cliente").fill("(31) 99999-7788");
  await creation.getByLabel("E-mail do cliente").fill("parcelado@exemplo.com");
  const productSearch = creation.getByRole("combobox", { name: "Produto 1", exact: true });
  await productSearch.fill("Organizador semanal premium");
  await creation.getByRole("option", { name: /Organizador semanal premium/ }).click();
  await creation.getByRole("button", { name: "Criar pedido e reservar estoque" }).click();

  const detail = page.getByRole("dialog", { name: /Pedido / });
  await detail.getByRole("button", { name: "Registrar pagamento" }).click();
  await detail.getByRole("radio", { name: /Pagamento em partes/ }).click();
  await detail.getByLabel("Valor recebido").fill("25");
  await detail.getByLabel("Observação do pagamento").fill("Primeira parcela via Pix");
  await detail.getByRole("button", { name: "Confirmar recebimento" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Pagamento parcial registrado" })).toBeVisible();
  await expect(detail.getByLabel("Situação do pagamento: Parcial")).toBeVisible();
  await expect(detail.getByText("Primeira parcela via Pix", { exact: false })).toBeVisible();

  await detail.getByRole("button", { name: "Registrar pagamento" }).click();
  await detail.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Pagamento integral registrado" })).toBeVisible();
  await expect(detail.getByText("Pedido quitado", { exact: true })).toBeVisible();
  await expect(detail.getByLabel("Situação do pagamento: Recebido")).toBeVisible();
});

test("oferece busca rápida no pedido manual e monitora carrinhos abandonados", async ({ page }) => {
  await login(page);
  await openSection(page, "Pedidos");
  await page.getByRole("button", { name: "Criar pedido", exact: true }).click();

  const modal = page.getByRole("dialog", { name: "Criar pedido" });
  const customerSearch = modal.getByRole("combobox", { name: "Buscar cliente no CRM" });
  await customerSearch.fill("Maria Teste");
  await modal.getByRole("option", { name: /Maria Teste/ }).click();
  await expect(modal.getByLabel("Nome completo do cliente")).toHaveValue("Maria Teste");
  await modal.locator("header").getByRole("button", { name: "Fechar" }).click();

  await openSection(page, "Carrinhos abandonados");
  await expect(page.getByRole("heading", { name: "Carrinhos abandonados", level: 2 })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Abandonado/ })).toBeVisible();
  await expect(page.getByLabel("Buscar carrinhos")).toBeVisible();
});

test("prepara uma mensagem de WhatsApp e registra o contato no CRM", async ({ page }) => {
  await login(page);
  await openSection(page, "Pedidos");

  await expect(page.getByRole("heading", { name: "As conversas certas, na hora certa." })).toBeVisible();
  await expect(page.getByText("sem API ou disparo automático", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Preparar mensagem" }).first().click();

  const dialog = page.getByRole("dialog", { name: /Preparar mensagem para/ });
  await expect(dialog).toBeVisible();
  const message = dialog.getByLabel("Mensagem pronta");
  await expect(message).toHaveValue(/pedido/i);
  const whatsappLink = dialog.getByRole("link", { name: /Abrir WhatsApp/ });
  await expect(whatsappLink).toHaveAttribute("href", /^https:\/\/wa\.me\/\d+\?text=/);
  await dialog.getByRole("button", { name: "Já enviei — registrar" }).click();

  await expect(dialog.getByText("Contato registrado.", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/timeline do CRM/)).toBeVisible();
});

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
  await expect(page.locator(".layout-page-select").filter({ hasText: "Guia de compra" })).toBeVisible();

  await page.getByRole("button", { name: "Adicionar seção" }).click();
  const blockModal = page.getByRole("dialog", { name: "Adicionar seção" });
  await expect(blockModal).toBeVisible();
  await blockModal.getByLabel("Tipo de conteúdo").selectOption("cta");
  await blockModal.getByRole("button", { name: "Aparência" }).click();
  await blockModal.getByLabel("Nome para identificar no painel").fill("Chamada principal");
  await blockModal.getByRole("button", { name: "Conteúdo" }).click();
  await blockModal.getByRole("textbox", { name: "Título que o cliente verá", exact: true }).fill("Encontre o produto ideal.");
  await blockModal.getByRole("textbox", { name: "Texto de apoio", exact: true }).fill("Uma chamada configurada pelo editor modular.");
  await blockModal.getByRole("textbox", { name: "Texto do botão", exact: true }).fill("Ver catálogo");
  await blockModal.getByLabel("Destino do botão").fill("/#catalogo");
  await blockModal.getByRole("button", { name: "Salvar e publicar" }).click();
  await expect(page.getByText("Chamada principal", { exact: true })).toBeVisible();
});

test("centraliza o conteúdo da home no editor da loja", async ({ page }) => {
  await login(page);

  const navigation = page.getByRole("navigation", { name: "Navegação administrativa" });
  await expect(navigation.getByRole("link", { name: "Conteúdo da home", exact: true })).toHaveCount(0);
  await openSection(page, "Editor da loja");
  await expect(page.getByText("Tudo da loja em um único editor", { exact: true })).toBeVisible();

  const featuredBlock = page.locator(".layout-block-list > article").filter({ hasText: "Produtos em destaque" }).first();
  await featuredBlock.getByRole("button", { name: "Editar conteúdo" }).click();
  const modal = page.getByRole("dialog", { name: "Editar seção" });
  await expect(modal.getByLabel("Título que o cliente verá")).toHaveValue("Destaques da Junior Imports.");
  await modal.getByRole("button", { name: "Cancelar" }).click();

  await page.goto("/admin/sections");
  await expect(page).toHaveURL(/\/admin\/layout$/);
});

test("configura produtos em destaque diretamente no editor da loja", async ({ page }) => {
  await login(page);
  await openSection(page, "Editor da loja");

  const featuredBlock = page.locator(".layout-block-list > article").filter({ hasText: "Produtos em destaque" }).first();
  await featuredBlock.getByRole("button", { name: "Editar conteúdo" }).click();

  const modal = page.getByRole("dialog", { name: "Editar seção" });
  await expect(modal.getByLabel("Título que o cliente verá")).toBeVisible();
  await modal.getByRole("button", { name: "Itens exibidos" }).click();
  await expect(modal.locator(".layout-resource-heading strong").filter({ hasText: "Produtos em destaque" })).toBeVisible();
  await expect(modal.getByLabel("Buscar produto")).toBeVisible();

  const productChoices = modal.locator(".product-choice-grid input[type=checkbox]");
  await expect(productChoices.first()).toBeVisible();
  const checkedBefore = await productChoices.evaluateAll((inputs) => inputs.filter((input) => (input as HTMLInputElement).checked).length);
  expect(checkedBefore).toBeGreaterThan(0);

  const firstChoice = productChoices.first();
  await firstChoice.click();
  if (checkedBefore === 1) await productChoices.nth(1).click();
  await modal.getByRole("button", { name: "Conteúdo" }).click();
  await modal.getByLabel("Título que o cliente verá").fill("Seleção especial E2E");
  await modal.getByRole("button", { name: "Salvar e publicar" }).click();

  await expect(page.getByRole("status").filter({ hasText: "Container salvo." })).toBeVisible();
  await featuredBlock.getByRole("button", { name: "Editar conteúdo" }).click();
  const editedModal = page.getByRole("dialog", { name: "Editar seção" });
  await editedModal.getByRole("button", { name: "Conteúdo" }).click();
  await expect(editedModal.getByLabel("Título que o cliente verá")).toHaveValue("Seleção especial E2E");
});

test("impede publicar uma pergunta frequente ainda vazia", async ({ page }) => {
  await login(page);
  await openSection(page, "Editor da loja");

  const faqBlock = page.locator(".layout-section-card.kind-faq");
  await faqBlock.getByRole("button", { name: "Editar conteúdo" }).click();
  const modal = page.getByRole("dialog", { name: "Editar seção" });
  await modal.getByRole("button", { name: "Itens exibidos" }).click();

  const rows = modal.locator(".layout-editable-list > article");
  const countBefore = await rows.count();
  await modal.getByRole("button", { name: "Adicionar pergunta" }).click();
  await expect(rows).toHaveCount(countBefore + 1);

  const addedRow = rows.nth(countBefore);
  await expect(addedRow.getByLabel("Pergunta")).toHaveValue("");
  await expect(addedRow.getByLabel("Resposta")).toHaveValue("");
  await modal.getByRole("button", { name: "Salvar e publicar" }).click();
  await expect(modal.getByText("Preencha todas as perguntas e respostas antes de publicar.")).toBeVisible();

  await addedRow.getByLabel("Pergunta").fill("Como acompanho meu pedido?");
  await addedRow.getByLabel("Resposta").fill("A equipe envia as atualizações pelo WhatsApp.");
  await modal.getByRole("button", { name: "Salvar e publicar" }).click();
  await expect(modal).toBeHidden();
  await expect(faqBlock).toContainText(`${countBefore + 1} perguntas`);

  await faqBlock.getByRole("button", { name: "Editar conteúdo" }).click();
  const reopenedModal = page.getByRole("dialog", { name: "Editar seção" });
  await reopenedModal.getByRole("button", { name: "Itens exibidos" }).click();
  const reopenedRows = reopenedModal.locator(".layout-editable-list > article");
  await expect(reopenedRows).toHaveCount(countBefore + 1);
  const persistedRow = reopenedRows.nth(countBefore);
  await expect(persistedRow.getByLabel("Pergunta")).toHaveValue("Como acompanho meu pedido?");
  await expect(persistedRow.getByLabel("Resposta")).toHaveValue("A equipe envia as atualizações pelo WhatsApp.");
});

test("configura mensagem automatica e registra o disparo", async ({ page }) => {
  await login(page);
  await openSection(page, "Campanhas e automações");
  await page.getByRole("button", { name: "Automações", exact: true }).click();
  await page.getByRole("button", { name: "Nova automação" }).first().click();
  const automationModal = page.locator(".automation-builder-modal");
  await automationModal.getByLabel("Nome", { exact: true }).fill("Aviso de preparação");
  await automationModal.locator("label").filter({ hasText: "Evento" }).locator("select").selectOption("Entregue");
  await automationModal.getByRole("textbox", { name: "Mensagem", exact: true }).fill("Olá, {{cliente}}! O pedido {{pedido}} está sendo preparado.");
  await automationModal.locator("label").filter({ hasText: /^StatusRascunho/ }).locator("select").selectOption("active");
  await automationModal.getByRole("button", { name: "Salvar automação" }).click();
  await expect(page.getByText("Aviso de preparação", { exact: true })).toBeVisible();

  await openSection(page, "Pedidos");
  const orderButtonName = (page.viewportSize()?.width ?? 1280) < 760 ? "Abrir pedido" : "Abrir";
  const orderButton = page.getByRole("button", { name: orderButtonName, exact: true }).first();
  await expect(orderButton).toBeVisible();
  await orderButton.click();
  const orderModal = page.getByRole("dialog");
  const registerPayment = orderModal.getByRole("button", { name: "Registrar pagamento" });
  if (await registerPayment.isVisible()) {
    await registerPayment.click();
    await orderModal.getByRole("button", { name: "Confirmar recebimento" }).click();
  }
  await orderModal.getByLabel("Situação do pedido").selectOption("Entregue");
  await orderModal.getByRole("button", { name: "Revisar alteração" }).click();
  await orderModal.getByRole("button", { name: "Confirmar alteração" }).click();
  await openSection(page, "Campanhas e automações");
  await page.getByRole("button", { name: "Automações", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Aviso de preparação", exact: true })).toBeVisible();
});

test("cria usuario e personaliza suas permissoes", async ({ page }) => {
  await login(page);
  await openSection(page, "Acessos e permissões");
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
  await page.locator(".admin-actions button[aria-label^='Editar ']").first().click();
  const couponModal = page.locator(".coupon-editor-panel");
  await couponModal.getByLabel("Limite por cliente").fill("2");
  await couponModal.getByRole("button", { name: "Salvar cupom" }).click();
  await expect(page.getByRole("cell").filter({ hasText: /2 usos/ }).first()).toBeVisible();

  await openSection(page, "Produtos");
  const skuText = await ((page.viewportSize()?.width ?? 1280) < 760
    ? page.locator(".admin-mobile-cards .admin-product-cell small").first()
    : page.locator(".admin-products-desktop .admin-product-cell small").first()).textContent();
  const sku = skuText?.split(" · ")[0]?.trim();
  expect(sku).toBeTruthy();

  await page.getByRole("link", { name: "Importar planilha", exact: true }).click();
  await page.getByRole("button", { name: "Atualizar estoque" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "estoque-e2e.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`sku;quantidade\n${sku};8`),
  });
  await expect(page.getByText("Pronto para importar", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Confirmar 1 linha" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Estoque de 1 produto atualizado." })).toBeVisible();

  await openSection(page, "Loja, frete e atendimento");
  const freeShippingToggle = page.getByLabel("Oferecer frete grátis por valor mínimo");
  if (!await freeShippingToggle.isChecked()) await freeShippingToggle.check();
  await page.getByLabel("Valor mínimo do pedido").fill("777");
  await expect(page.getByText(/Pedidos a partir de R\$\s*777,00 recebem frete grátis\./)).toBeVisible();
  await page.getByRole("button", { name: "Salvar configurações" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Configurações salvas." })).toBeVisible();
});

test("abre CRM, financeiro, estoque e compras em desktop e mobile", async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await page.goto("/admin/crm");
  await expect(page.getByRole("heading", { name: "Relacionamento que vira próxima ação." })).toBeVisible();
  await page.getByRole("button", { name: "Nova tarefa" }).click();
  await expect(page.getByRole("heading", { name: "Nova tarefa" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.goto("/admin/finance");
  await expect(page.getByRole("heading", { name: "Veja o que entrou, saiu e ainda precisa entrar." })).toBeVisible();
  await page.getByRole("button", { name: "Registrar entrada ou saída" }).click();
  await expect(page.getByRole("heading", { name: "O dinheiro entrou ou saiu?" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.goto("/admin/inventory");
  await expect(page.getByRole("heading", { name: "Saldo confiável, movimentos rastreáveis." })).toBeVisible();
  await page.getByRole("button", { name: "Movimentar estoque" }).click();
  await expect(page.getByRole("heading", { name: "Registrar movimento" })).toBeVisible();
  await page.getByRole("button", { name: "Cancelar" }).click();

  await page.goto("/admin/purchasing");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole("heading", { name: "Prioridades de hoje" })).toBeVisible();
});
