import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedData } from "@/data/seed";
import { resolveElectronicsHome } from "@/lib/electronics-home";
import { ElectronicsMobileCarousel } from "./electronics-mobile-carousel";

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <span data-image={src}>{alt}</span> }));
vi.mock("@/components/ui/product-art", () => ({ ProductArt: () => <span>Foto do produto</span> }));

let reducedMotion = false;
let mobile = true;
const changes: Array<() => void> = [];

function content() {
  const blocks = resolveElectronicsHome(seedData.tenant.id, []);
  return { ...blocks, "banner-2": { ...blocks["banner-2"], active: true } };
}
function activeBanner(number: number) {
  return screen.getByRole("article", { name: `Banner ${number} de 2` });
}

beforeEach(() => {
  vi.useFakeTimers();
  reducedMotion = false;
  mobile = true;
  changes.length = 0;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() { return query.includes("reduced-motion") ? reducedMotion : mobile; },
    addEventListener: (_: string, listener: () => void) => changes.push(listener),
    removeEventListener: vi.fn(),
  }));
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("carrossel mobile de eletrônicos", () => {
  it("exibe somente banners ativos e identifica o preço do produto real", () => {
    render(<ElectronicsMobileCarousel content={resolveElectronicsHome(seedData.tenant.id, [])} spotlight={{ ...seedData.products[0], name: "iPhone 15", price: 2930, madeToOrder: true }} seconds={5} />);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByText("iPhone 15")).toBeVisible();
    expect(screen.getByText("R$ 2.930,00")).toBeVisible();
    expect(screen.getByText("Sob encomenda")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Próximo banner" })).not.toBeInTheDocument();
  });

  it("alterna automaticamente e deixa os links ocultos inertes", () => {
    const { container } = render(<ElectronicsMobileCarousel content={content()} seconds={5} />);
    expect(activeBanner(1)).not.toHaveAttribute("inert");
    expect(container.querySelectorAll("article[inert]")).toHaveLength(1);
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(2)).not.toHaveAttribute("inert");
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(1)).toBeVisible();
  });

  it("permite avançar, voltar, selecionar e pausar a rotação", () => {
    render(<ElectronicsMobileCarousel content={content()} seconds={5} />);
    fireEvent.click(screen.getByRole("button", { name: "Próximo banner" }));
    expect(activeBanner(2)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Banner anterior" }));
    expect(activeBanner(1)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Exibir banner 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Pausar rotação dos banners" }));
    act(() => vi.advanceTimersByTime(10000));
    expect(activeBanner(2)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Retomar rotação dos banners" }));
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(1)).toBeVisible();
  });

  it("não gira no desktop nem com movimento reduzido e respeita mudanças de preferência", () => {
    reducedMotion = true;
    render(<ElectronicsMobileCarousel content={content()} seconds={5} />);
    act(() => vi.advanceTimersByTime(10000));
    expect(activeBanner(1)).toBeVisible();
    reducedMotion = false;
    mobile = false;
    act(() => changes.forEach((change) => change()));
    act(() => vi.advanceTimersByTime(10000));
    expect(activeBanner(1)).toBeVisible();
    mobile = true;
    act(() => changes.forEach((change) => change()));
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(2)).toBeVisible();
  });

  it("pausa enquanto a aba está oculta e enquanto o usuário lê com foco", () => {
    render(<ElectronicsMobileCarousel content={content()} seconds={5} />);
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    fireEvent(document, new Event("visibilitychange"));
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(1)).toBeVisible();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    fireEvent(document, new Event("visibilitychange"));
    const region = screen.getByRole("region", { name: "Destaques da loja" });
    fireEvent.focus(screen.getByRole("link", { name: "Ver eletrônicos" }));
    fireEvent.mouseEnter(region);
    fireEvent.mouseLeave(region);
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(1)).toBeVisible();
    fireEvent.blur(region, { relatedTarget: null });
    act(() => vi.advanceTimersByTime(5000));
    expect(activeBanner(2)).toBeVisible();
  });

  it("aceita gesto horizontal sem confundir a rolagem vertical", () => {
    const { container } = render(<ElectronicsMobileCarousel content={content()} seconds={5} />);
    const slides = container.querySelector(".electronics-mobile-slides")!;
    fireEvent.touchStart(slides, { touches: [{ clientX: 250, clientY: 100 }] });
    fireEvent.touchEnd(slides, { changedTouches: [{ clientX: 80, clientY: 110 }] });
    expect(activeBanner(2)).toBeVisible();
    fireEvent.touchStart(slides, { touches: [{ clientX: 80, clientY: 100 }] });
    fireEvent.touchEnd(slides, { changedTouches: [{ clientX: 150, clientY: 250 }] });
    expect(activeBanner(2)).toBeVisible();
  });

  it("mantém links dentro da vitrine e não atribui preço do produto a um banner enviado", () => {
    const blocks = content();
    blocks.hero = { ...blocks.hero, imageUrl: "https://example.com/banner.jpg", buttonLink: "https://outro.com" };
    render(<ElectronicsMobileCarousel content={blocks} spotlight={seedData.products[0]} seconds={5} storefrontPath="/loja/teste" />);
    expect(screen.getByRole("link", { name: "Ver eletrônicos" })).toHaveAttribute("href", "/loja/teste#catalogo");
    expect(screen.queryByText("Foto do produto")).not.toBeInTheDocument();
  });
});
