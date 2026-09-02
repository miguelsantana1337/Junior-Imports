// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

afterEach(() => vi.unstubAllEnvs());
function request(path = "/", host = "junior-imports.vercel.app", headers = {}) {
  return new NextRequest(`https://${host}${path}`, { headers: { host, ...headers } });
}
const pharmaHost = "farmaceuticos.juniorimportsoficial.com.br";
const scopeHeader = "x-middleware-request-x-storefront-scope";

describe("separação das lojas por hostname", () => {
  it("define eletrônicos na raiz e ignora escopo enviado pelo visitante", async () => {
    vi.stubEnv("SAAS_ROOT_DOMAIN", "");
    const response = await proxy(request("/", undefined, { "x-storefront-scope": "pharmaceutical", "x-tenant-domain": "junior-imports" }));
    expect(response.headers.get(scopeHeader)).toBe("electronics");
    expect(response.headers.has("x-middleware-request-x-tenant-domain")).toBe(false);
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
  });

  it.each(["/", "/checkout", "/produtos/exemplo?ref=abc", "/paginas/informacoes"])("reescreve %s somente no subdomínio separado", async (path) => {
    const response = await proxy(request(path, pharmaHost));
    const rewritten = new URL(response.headers.get("x-middleware-rewrite")!);
    expect(rewritten.pathname).toBe(`/loja/junior-imports${path === "/" ? "" : path.split("?")[0]}`);
    expect(rewritten.search).toBe(new URL(`https://${pharmaHost}${path}`).search);
    expect(response.headers.get(scopeHeader)).toBe("pharmaceutical");
    expect(response.headers.get("x-middleware-request-x-tenant-domain")).toBe("junior-imports");
  });

  it.each(["/admin/login", "/api/storefront/orders", "/mcp", "/.well-known/oauth-authorization-server"])("preserva infraestrutura %s", async (path) => {
    const response = await proxy(request(path, pharmaHost, { "x-storefront-scope": "electronics" }));
    expect(response.headers.has("x-middleware-rewrite")).toBe(false);
    expect(response.headers.get(scopeHeader)).toBe("all");
  });

  it("preserva consulta e indicação ao redirecionar a URL antiga de eletrônicos", async () => {
    const response = await proxy(request("/eletronicos?q=iphone&ref=abc"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://junior-imports.vercel.app/?q=iphone&ref=abc");
  });

  it("canonicaliza a rota interna no próprio domínio sem saltar de catálogo", async () => {
    const response = await proxy(request("/loja/junior-imports/checkout?ref=abc", pharmaHost));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(`https://${pharmaHost}/checkout?ref=abc`);
  });

  it("não permite que sufixos parecidos com arquivos removam o escopo", async () => {
    const response = await proxy(request("/produtos/exemplo.jpg"));
    expect(response.headers.get(scopeHeader)).toBe("electronics");
  });
});
