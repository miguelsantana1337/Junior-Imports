import type { PageBlock, StorePage } from "@/types/store";

export const electronicsHomeKeys = ["hero", "banner-2", "banner-3", "catalog", "guide", "step-1", "step-2", "step-3", "announcement", "footer"] as const;
export type ElectronicsHomeKey = typeof electronicsHomeKeys[number];
export const electronicsBannerKeys = ["hero", "banner-2", "banner-3"] as const satisfies readonly ElectronicsHomeKey[];
export const electronicsDescription = "Tecnologia, atendimento especializado e informações claras para comprar eletrônicos de qualquer lugar do Brasil.";

const defaults: Record<ElectronicsHomeKey, Partial<PageBlock> & Pick<PageBlock, "name" | "title" | "body">> = {
  hero: { name: "Banner principal", eyebrow: "JUNIOR IMPORTS · ELETRÔNICOS", title: "Tecnologia que você quer.\nCompra do jeito certo.", body: "Encontre iPhone, MacBook, iPad, Apple Watch, AirPods e acessórios com informações claras e atendimento especializado.", buttonText: "Ver produtos", buttonLink: "/#catalogo" },
  "banner-2": { name: "Banner rotativo 2", eyebrow: "COMPRA ACOMPANHADA", title: "Do catálogo\nao WhatsApp.", body: "Escolha seu produto e confirme disponibilidade, prazo e condições com a equipe.", buttonText: "Como comprar", buttonLink: "/#como-comprar", active: false },
  "banner-3": { name: "Banner rotativo 3", eyebrow: "ENCONTRE SEU MODELO", title: "Sua próxima escolha\ncomeça aqui.", body: "Explore iPhone, Apple Watch, iPad, MacBook, AirPods e acessórios.", buttonText: "Explorar catálogo", buttonLink: "/#catalogo", active: false },
  catalog: { name: "Catálogo", kind: "catalog", eyebrow: "ENCONTRE O QUE PROCURA", title: "O ecossistema Apple em um só lugar.", body: "Compare modelos, capacidades, condições e valores antes de escolher.", columns: 4 },
  guide: { name: "Como comprar", eyebrow: "SUA COMPRA EM POUCOS PASSOS", title: "Do produto certo ao pedido acompanhado.", body: "Escolha o produto, revise os dados e acompanhe cada etapa pelo canal informado no pedido." },
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
