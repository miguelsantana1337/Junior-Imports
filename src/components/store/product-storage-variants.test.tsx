import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedData } from "@/data/seed";
import type { StorefrontProduct } from "@/types/store";
import { groupElectronicsProductModels } from "@/lib/electronics-product-variants";
import { ProductCard } from "./product-card";
import { ProductDetail } from "./product-detail";

const mocks = vi.hoisted(() => ({ addItem: vi.fn(), toggleFavorite: vi.fn(), setDrawerOpen: vi.fn(), trackEvent: vi.fn(), toast: vi.fn() }));
vi.mock("@/components/providers/cart-provider", () => ({ useCart: () => ({ ...mocks, ready: true, favorites: [] }) }));
vi.mock("@/components/providers/toast-provider", () => ({ useToast: () => mocks.toast }));
vi.mock("@/components/providers/store-provider", () => ({ useStore: () => ({ data, storefrontScope: scope }) }));
vi.mock("@/components/ui/product-art", () => ({ ProductArt: ({ product }: { product: StorefrontProduct }) => <span>Foto de {product.name}</span> }));

function product(capacity: string, price: number, stock: number): StorefrontProduct {
  return { ...seedData.products[0], id: `pro-${capacity}`, slug: `iphone-17-pro-${capacity}`, name: `iPhone 17 Pro ${capacity.toUpperCase()}`,
    categoryId: "electronics", category: "Eletrônicos", brand: "Apple", productType: "non_medicine", regulatoryStatus: "approved",
    active: true, stock, price, compareAt: 0, cashback: 0, imageUrl: "", imageUrls: [], description: "", madeToOrder: true };
}
let products = [product("256gb", 7800, 5), product("512gb", 9350, 2)];
let data = { ...seedData, products, bundles: [], cashbackCampaigns: [] };
let scope = "electronics";
beforeEach(() => {
  vi.clearAllMocks();
  products = [product("256gb", 7800, 5), product("512gb", 9350, 2)];
  data = { ...seedData, products, bundles: [], cashbackCampaigns: [] };
  scope = "electronics";
});
afterEach(cleanup);

describe("escolha da capacidade antes da compra", () => {
  it("mostra um cartão do modelo com capacidades e preço inicial, sem adicionar um SKU arbitrário", () => {
    const model = groupElectronicsProductModels(products)[0];
    render(<ProductCard {...model} />);
    expect(screen.getByRole("heading", { name: "iPhone 17 Pro" })).toBeVisible();
    expect(screen.getByText("256 GB")).toBeVisible();
    expect(screen.getByText("512 GB")).toBeVisible();
    expect(screen.getByText("A partir de")).toBeVisible();
    expect(screen.getByRole("link", { name: "Escolher armazenamento de iPhone 17 Pro" })).toHaveAttribute("href", "/produtos/iphone-17-pro-256gb");
    expect(screen.queryByRole("button", { name: /Adicionar .* ao carrinho/ })).not.toBeInTheDocument();
    expect(mocks.addItem).not.toHaveBeenCalled();
  });

  it("mantém compra direta para produtos com uma única capacidade", () => {
    render(<ProductCard product={products[0]} />);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar ${products[0].name} ao carrinho` }));
    expect(mocks.addItem).toHaveBeenCalledWith("pro-256gb");
  });

  it("seleciona pelo slug, mostra o preço exato e adiciona somente o ID escolhido", () => {
    render(<ProductDetail slug="iphone-17-pro-512gb" />);
    const storage = screen.getByRole("navigation", { name: "Opções de armazenamento" });
    expect(within(storage).getByRole("link", { name: /^512 GB,/ })).toHaveAttribute("aria-current", "true");
    expect(within(storage).getByRole("link", { name: /^256 GB,/ })).not.toHaveAttribute("aria-current");
    expect(within(storage).getByRole("link", { name: /^256 GB,/ })).toHaveAttribute("href", "/produtos/iphone-17-pro-256gb");
    expect(document.querySelector(".detail-price strong")).toHaveTextContent("R$ 9.350,00");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(mocks.addItem).toHaveBeenCalledWith("pro-512gb", 1, []);
    expect(mocks.toast).toHaveBeenCalledWith("iPhone 17 Pro 512GB adicionado ao carrinho.");
    expect(screen.queryByRole("heading", { name: "Produtos relacionados." })).not.toBeInTheDocument();
  });

  it("reinicia quantidade ao trocar de capacidade e respeita o estoque individual", () => {
    const { rerender } = render(<ProductDetail slug="iphone-17-pro-256gb" />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    expect(document.querySelector(".quantity-picker span")).toHaveTextContent("3");
    rerender(<ProductDetail slug="iphone-17-pro-512gb" />);
    expect(document.querySelector(".quantity-picker span")).toHaveTextContent("1");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Aumentar quantidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao carrinho" }));
    expect(mocks.addItem).toHaveBeenCalledWith("pro-512gb", 2, []);
  });

  it("mantém a opção esgotada visível, sem permitir comprá-la", () => {
    data = { ...data, products: [products[0], { ...products[1], stock: 0 }] };
    render(<ProductDetail slug="iphone-17-pro-512gb" />);
    expect(screen.getByRole("link", { name: /^512 GB,.*Esgotado/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Adicionar ao carrinho" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consultar no WhatsApp" })).toBeVisible();
  });

  it("não agrupa na vitrine farmacêutica e não interfere nos links antigos", () => {
    scope = "pharmaceutical";
    render(<ProductDetail slug="iphone-17-pro-256gb" />);
    expect(screen.getByRole("heading", { name: "iPhone 17 Pro 256GB" })).toBeVisible();
    expect(screen.queryByRole("navigation", { name: "Opções de armazenamento" })).not.toBeInTheDocument();
  });
});
