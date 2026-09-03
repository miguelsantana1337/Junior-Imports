import type { PageBlock, StorePage } from "@/types/store";

export const electronicsHomeKeys = ["hero", "catalog", "guide", "step-1", "step-2", "step-3", "announcement", "footer"] as const;
export type ElectronicsHomeKey = typeof electronicsHomeKeys[number];
export const electronicsDescription = "Eletrônicos selecionados pela Junior Imports. Escolha seu produto e confirme os detalhes pelo WhatsApp.";

const defaults: Record<ElectronicsHomeKey, Partial<PageBlock> & Pick<PageBlock, "name" | "title" | "body">> = {
  hero: { name: "Banner principal", eyebrow: "JUNIOR IMPORTS · ELETRÔNICOS", title: "Tecnologia Apple,\ndireta ao ponto.", body: "Encontre seu próximo eletrônico, confira os detalhes e tire suas dúvidas com a equipe antes de comprar.", buttonText: "Ver eletrônicos", buttonLink: "/#catalogo" },
  catalog: { name: "Catálogo", kind: "catalog", eyebrow: "SOMENTE ELETRÔNICOS", title: "Tecnologia selecionada para comprar com clareza.", body: "Busque por modelo, compare as opções e finalize com atendimento humano.", columns: 4 },
  guide: { name: "Como comprar", eyebrow: "COMPRA ACOMPANHADA", title: "Do modelo certo ao pedido confirmado.", body: "A loja organiza sua escolha. A equipe confirma disponibilidade, condição e atendimento pelo WhatsApp." },
  "step-1": { name: "Como comprar — primeiro passo", title: "Escolha o produto", body: "Consulte modelos, capacidades e valores disponíveis no catálogo." },
  "step-2": { name: "Como comprar — segundo passo", title: "Revise no carrinho", body: "Confira os itens e informe os dados necessários para registrar o pedido." },
  "step-3": { name: "Como comprar — terceiro passo", title: "Confirme com a equipe", body: "Finalize e continue o atendimento no WhatsApp oficial da Junior Imports." },
  announcement: { name: "Barra de anúncio", title: "Tecnologia Apple e eletrônicos selecionados pela Junior Imports.", body: "", buttonText: "Ver eletrônicos", buttonLink: "/#catalogo" },
  footer: { name: "Rodapé", title: "Sobre a loja de eletrônicos", body: electronicsDescription },
};

export function electronicsHomePageId(tenantId: string) {
  return `electronics-home:${tenantId}`;
}

export function electronicsHomePage(tenantId: string): StorePage {
  return { id: electronicsHomePageId(tenantId), name: "Home de eletrônicos", slug: "electronics-home", title: "Eletrônicos", description: electronicsDescription, active: true, showInNavigation: false, isHome: false, order: 999 };
}

export function electronicsHomeBlock(tenantId: string, key: ElectronicsHomeKey): PageBlock {
  return {
    id: `electronics:${tenantId}:${key}`, pageId: electronicsHomePageId(tenantId),
    kind: "text", eyebrow: "", buttonText: "", buttonLink: "", imageUrl: "",
    backgroundColor: "", textColor: "", containerWidth: "normal", padding: "large", columns: 1,
    active: true, order: electronicsHomeKeys.indexOf(key) + 1, ...defaults[key],
  };
}

export function resolveElectronicsHome(tenantId: string, blocks: PageBlock[]) {
  return Object.fromEntries(electronicsHomeKeys.map((key) => {
    const fallback = electronicsHomeBlock(tenantId, key);
    const saved = blocks.find((block) => block.id === fallback.id && block.pageId === fallback.pageId);
    return [key, saved ?? fallback];
  })) as Record<ElectronicsHomeKey, PageBlock>;
}

// The electronics editor links only within its own storefront. External contact
// continues through the WhatsApp configured in Settings.
export function electronicsHomeHref(value: string) {
  return /^\/(?!\/)[^\\\s]*$/.test(value) || /^#[a-zA-Z0-9_-]+$/.test(value)
    ? value : "/#catalogo";
}
