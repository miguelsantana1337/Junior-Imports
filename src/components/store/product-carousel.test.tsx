import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProductCarousel } from "./product-carousel";

vi.mock("./product-card", () => ({ ProductCard: () => <article className="product-card" /> }));
beforeEach(() => vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const group = { id: "electronics", slug: "eletronicos", name: "Eletrônicos", products: [] };

describe("colunas configuradas na vitrine", () => {
  it("leva a escolha do editor à propriedade CSS da grade", () => {
    const { container } = render(<ProductCarousel group={group} desktopColumns={2} />);
    expect(container.querySelector<HTMLElement>(".product-carousel-track")?.style.getPropertyValue("--catalog-columns")).toBe("2");
  });
  it("mantém o estilo original quando não há configuração por catálogo", () => {
    const { container } = render(<ProductCarousel group={group} />);
    expect(container.querySelector(".product-carousel-track")).not.toHaveAttribute("style");
  });
  it("limita valores fora da faixa do editor", () => {
    const { container } = render(<ProductCarousel group={group} desktopColumns={20} />);
    expect(container.querySelector<HTMLElement>(".product-carousel-track")?.style.getPropertyValue("--catalog-columns")).toBe("4");
  });
});
