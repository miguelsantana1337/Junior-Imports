import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seedData } from "@/data/seed";
import { electronicsHomeBlock, electronicsHomePage } from "@/lib/electronics-home";
import { ElectronicsHomeAdmin } from "./electronics-home-admin";

const handlers = vi.hoisted(() => ({ savePage: vi.fn(), savePageBlock: vi.fn(), uploadMedia: vi.fn(), useAdminData: vi.fn() }));
vi.mock("./admin-data-provider", () => ({ useAdminData: handlers.useAdminData }));

beforeEach(() => {
  vi.resetAllMocks();
  handlers.savePage.mockResolvedValue(undefined);
  handlers.savePageBlock.mockResolvedValue(undefined);
  handlers.useAdminData.mockReturnValue({ data: seedData, ...handlers });
});
afterEach(cleanup);

function announcementForm() {
  const section = screen.getByRole("heading", { name: "Barra de anúncio" }).closest("section")!;
  return within(section);
}

describe("edição de eletrônicos no painel compartilhado", () => {
  it("salva somente a seção de eletrônicos e cria sua página antes do primeiro uso", async () => {
    render(<ElectronicsHomeAdmin />);
    const form = announcementForm();
    fireEvent.change(form.getByLabelText("Texto da barra"), { target: { value: "Novos modelos Apple" } });
    fireEvent.click(form.getByRole("button", { name: "Salvar seção" }));
    await waitFor(() => expect(handlers.savePageBlock).toHaveBeenCalledOnce());
    expect(handlers.savePage).toHaveBeenCalledWith(electronicsHomePage(seedData.tenant.id));
    expect(handlers.savePageBlock).toHaveBeenCalledWith({ ...electronicsHomeBlock(seedData.tenant.id, "announcement"), title: "Novos modelos Apple" });
  });
  it("preserva o texto digitado e permite tentar novamente quando a gravação falha", async () => {
    handlers.savePageBlock.mockRejectedValue(new Error("Falha de conexão"));
    render(<ElectronicsHomeAdmin />);
    const form = announcementForm();
    fireEvent.change(form.getByLabelText("Texto da barra"), { target: { value: "Título ainda não salvo" } });
    fireEvent.click(form.getByRole("button", { name: "Salvar seção" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de conexão");
    expect(form.getByLabelText("Texto da barra")).toHaveValue("Título ainda não salvo");
    expect(form.getByRole("button", { name: "Salvar seção" })).toBeEnabled();
  });
  it("reutiliza a página existente e impede um link para outro domínio", async () => {
    handlers.useAdminData.mockReturnValue({ data: { ...seedData, pages: [...seedData.pages, electronicsHomePage(seedData.tenant.id)] }, ...handlers });
    render(<ElectronicsHomeAdmin />);
    const form = announcementForm();
    fireEvent.change(form.getByLabelText(/Destino dentro da loja/), { target: { value: "https://outro.com" } });
    fireEvent.click(form.getByRole("button", { name: "Salvar seção" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Use um destino dentro da loja");
    expect(handlers.savePageBlock).not.toHaveBeenCalled();
    fireEvent.change(form.getByLabelText(/Destino dentro da loja/), { target: { value: "/#como-comprar" } });
    fireEvent.click(form.getByRole("button", { name: "Salvar seção" }));
    await waitFor(() => expect(handlers.savePageBlock).toHaveBeenCalledOnce());
    expect(handlers.savePage).not.toHaveBeenCalled();
  });
});
