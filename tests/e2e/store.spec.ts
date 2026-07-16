import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
});

test("mantém o catálogo fora dos buscadores e compartilhável", async ({ page, request }) => {
  const navigation = await page.goto("/");
  expect(navigation?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Junior Imports/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /^https?:\/\//);

  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  const body = await response.text();
  expect(body).toMatch(/User-Agent:\s*WhatsApp[\s\S]*Allow:\s*\//i);
  expect(body).toMatch(/User-Agent:\s*facebookexternalhit[\s\S]*Allow:\s*\//i);
  expect(body).toMatch(/User-Agent:\s*\*/i);
  expect(body).toMatch(/Disallow:\s*\//i);
});

test("abre uma pagina individual de produto", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("PEDIDOS FINALIZADOS PELO WHATSAPP").first()).toBeVisible();
  await page.getByTestId("product-organizador-semanal-premium").first().getByRole("link", { name: "Organizador semanal premium", exact: true }).click();
  await expect(page).toHaveURL(/\/produtos\/organizador-semanal-premium$/);
  await expect(page.getByRole("heading", { name: "Organizador semanal premium" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Adicionar ao carrinho/ })).toBeVisible();
});

test("organiza o catálogo em carrosséis por categoria", async ({ page }) => {
  await page.goto("/");
  const catalog = page.locator("#catalogo");
  const categories = catalog.locator(".catalog-category");

  expect(await categories.count()).toBeGreaterThan(1);
  await expect(categories.first().locator(".catalog-category-header h3")).toBeVisible();
  await expect(categories.first().locator(".product-carousel-viewport")).toBeVisible();
  await expect(categories.first().locator(".product-card").first()).toBeVisible();
  await expect(catalog.locator(".product-grid")).toHaveCount(0);
});

test("permite adicionar ao carrinho um item sujeito a confirmação pelo WhatsApp", async ({ page }) => {
  await page.goto("/produtos/t-g-15");
  await expect(page.getByText("Solicitação sujeita a confirmação")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  const cart = page.getByRole("dialog", { name: "Carrinho" });
  await expect(cart).toBeVisible();
  await expect(cart.getByRole("heading", { name: "T.G. 15" })).toBeVisible();
});

test("conclui carrinho, cupom e envia o pedido para o WhatsApp", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Adicionar Organizador semanal premium ao carrinho" }).first().click();
  const cart = page.getByRole("dialog", { name: "Carrinho" });
  await expect(cart).toBeVisible();
  const couponInput = cart.getByLabel("Cupom de desconto");
  const couponCode = (await couponInput.getAttribute("placeholder"))?.replace("Ex.: ", "") ?? "JI10";
  await couponInput.fill(couponCode);
  await cart.getByRole("button", { name: "Aplicar" }).click();
  await expect(cart.getByText(`Cupom ${couponCode} aplicado.`)).toBeVisible();
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
  await page.route("https://wa.me/**", (route) => route.abort());
  const whatsappRequest = page.waitForRequest((request) => request.url().startsWith("https://wa.me/"));
  await page.getByRole("button", { name: "Enviar pedido pelo WhatsApp" }).click();
  const request = await whatsappRequest;
  const message = new URL(request.url()).searchParams.get("text") ?? "";
  expect(message).toContain("Cliente Demonstracao");
  expect(message).toContain("Organizador semanal premium");
  expect(message).toContain("JI-");
  expect(message).toContain("Forma de pagamento");
  expect(message).toContain("Cupom utilizado");
  expect(message).not.toContain("\\n");
});
