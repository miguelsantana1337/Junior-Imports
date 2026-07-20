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
  await expect(page.getByText("LOJA ABERTA PARA PEDIDOS").first()).toBeVisible();
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
  await expect(page.getByText("Compra com confirmação no WhatsApp")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  const cart = page.getByRole("dialog", { name: "Carrinho" });
  await expect(cart).toBeVisible();
  await expect(cart.getByRole("heading", { name: "T.G. 15" })).toBeVisible();
  const browserStorage = await page.evaluate(() => ({
    localSensitiveKeys: Object.keys(window.localStorage).filter((key) =>
      /:cart:v1$|:favorites:v1$|:store-data:v1$|product-draft:|auth-token/i.test(key),
    ),
    sessionCart: Object.keys(window.sessionStorage)
      .filter((key) => key.endsWith(":cart:v1"))
      .map((key) => window.sessionStorage.getItem(key)),
  }));
  expect(browserStorage.localSensitiveKeys).toEqual([]);
  expect(browserStorage.sessionCart.some((value) => value?.includes("productId"))).toBe(true);
});

test("conclui o carrinho e envia o pedido para o WhatsApp oficial", async ({ page }) => {
  await page.route("**/api/storefront/postal-code?cep=35160000", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ address: "Rua Exemplo", city: "Ipatinga", state: "MG", district: "Centro" }),
  }));
  await page.goto("/");
  const officialWhatsappHref = await page.locator(".whatsapp-float").getAttribute("href");
  expect(officialWhatsappHref).toMatch(/^https:\/\/wa\.me\/\d+/);
  const officialWhatsappPath = new URL(officialWhatsappHref!).pathname;
  await page.getByRole("button", { name: "Adicionar Organizador semanal premium ao carrinho" }).first().click();
  const cart = page.getByRole("dialog", { name: "Carrinho" });
  await expect(cart).toBeVisible();
  await cart.getByRole("link", { name: "Ir para o checkout" }).click();

  await page.getByLabel("Nome completo").fill("Cliente Demonstracao");
  await page.getByRole("textbox", { name: "WhatsApp", exact: true }).fill("(31) 99999-9999");
  await page.getByLabel("E-mail").fill("cliente@exemplo.com");
  await page.getByLabel("CEP").fill("35160-000");
  await expect(page.getByLabel("Logradouro")).toHaveValue("Rua Exemplo");
  await expect(page.getByLabel("Cidade")).toHaveValue("Ipatinga");
  await expect(page.getByLabel("Estado")).toHaveValue("MG");
  await expect(page.getByLabel("Número")).toHaveValue("");
  await expect(page.getByLabel("Complemento")).toHaveValue("");
  await expect(page.getByText("Dados do CEP preenchidos.")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Cartão 2x sem juros/ })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Dinheiro Pagamento combinado/ })).toBeVisible();
  await expect(page.getByText("Boleto", { exact: true })).toHaveCount(0);
  await page.getByLabel("Número").fill("100");
  await page.getByRole("checkbox", { name: "Declaração: Declaro que li e concordo com os termos acima." }).check();
  await page.getByRole("checkbox", { name: "Autorizo o envio dos dados deste pedido para o atendimento da loja pelo WhatsApp." }).check();
  await page.route("https://wa.me/**", (route) => route.abort());
  const whatsappRequest = page.waitForRequest((request) => request.url().startsWith("https://wa.me/"));
  await page.getByRole("button", { name: "Finalizar pedido no WhatsApp" }).click();
  const request = await whatsappRequest;
  expect(new URL(request.url()).pathname).toBe(officialWhatsappPath);
  const message = new URL(request.url()).searchParams.get("text") ?? "";
  expect(message).toContain("Cliente Demonstracao");
  expect(message).toContain("Organizador semanal premium");
  expect(message).toContain("JI-");
  expect(message).toContain("Forma de pagamento");
  expect(message).toContain("Cupom utilizado");
  expect(message).not.toContain("\\n");
});

test("exibe como comprar e o WhatsApp oficial no rodapé", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".desktop-nav").getByRole("link", { name: "Como comprar" })).toHaveAttribute("href", "/#duvidas");
  await expect(page.locator("#duvidas").getByRole("heading")).toBeVisible();
  await expect(page.locator("#duvidas").getByText("Como faço uma compra?")).toBeVisible();
  const footer = page.locator(".store-footer");
  const footerWhatsappHref = await footer.getByRole("link", { name: "Comprar pelo WhatsApp" }).getAttribute("href");
  const floatingWhatsappHref = await page.locator(".whatsapp-float").getAttribute("href");
  expect(footerWhatsappHref).toMatch(/^https:\/\/wa\.me\/\d+/);
  expect(new URL(footerWhatsappHref!).pathname).toBe(new URL(floatingWhatsappHref!).pathname);
});
