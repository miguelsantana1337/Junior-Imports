import type { StoreData } from "@/types/store";

export interface CopilotCard {
  title: string;
  detail: string;
  href: string;
  tone?: "default" | "warning" | "positive";
}

export interface CopilotAnswer {
  title: string;
  message: string;
  cards: CopilotCard[];
  sources: string[];
  intent: string;
}

const destructiveIntent = /\b(exclu|apag|remov|cancel|alter|mude|edite|publique|envie|cadastre|crie)\w*/i;

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function routeHelp(route: string): CopilotAnswer {
  const help: Array<[string, string, string, string]> = [
    ["/admin/products", "Catálogo de produtos", "Cadastre, revise preço, cashback, estoque, fotos e visibilidade de cada item.", "/admin/products"],
    ["/admin/inventory", "Estoque e lotes", "Acompanhe saldo, estoque mínimo, movimentações, validade e risco de ruptura.", "/admin/inventory"],
    ["/admin/reports", "Relatórios", "Compare períodos, salve visões e exporte CSV, Excel ou PDF.", "/admin/reports"],
    ["/admin/crm", "CRM", "Organize tarefas, contatos e oportunidades de relacionamento com clientes.", "/admin/crm"],
    ["/admin/messages", "Marketing Studio", "Planeje publicações e teste automações antes de ativar.", "/admin/messages"],
    ["/admin/collaboration", "Central da equipe", "Reúna tarefas, discussões, menções, aprovações e presença online.", "/admin/collaboration"],
  ];
  const match = help.find(([prefix]) => route.startsWith(prefix)) ?? ["/admin", "Painel de controle", "Use a visão geral para encontrar prioridades e atalhos para cada área.", "/admin"];
  return { title: `Ajuda: ${match[1]}`, message: match[2], cards: [{ title: "Abrir esta área", detail: "Navegação segura, sem alterar dados.", href: match[3] }], sources: ["Guia interno do painel", `Contexto da tela: ${route}`], intent: "help" };
}

export function buildCopilotAnswer(question: string, data: StoreData, route: string, now = new Date()): CopilotAnswer {
  const query = normalize(question.trim());
  if (!query) return routeHelp(route);

  if (destructiveIntent.test(query)) {
    return { title: "Modo somente leitura", message: "Neste lote eu não executo alterações. Posso localizar o registro, resumir a situação e levar você até a tela correta para decidir com segurança.", cards: [{ title: "Central da equipe", detail: "Peça revisão ou aprovação antes de agir.", href: "/admin/collaboration" }], sources: ["Política do Copiloto Junior"], intent: "blocked_mutation" };
  }

  if (/estoque|ruptura|baixo/.test(query)) {
    const items = data.products.filter((product) => product.active && product.stock <= product.minStock).sort((a, b) => a.stock - b.stock);
    return { title: "Estoque que precisa de atenção", message: items.length ? `Encontrei ${items.length} produto${items.length === 1 ? "" : "s"} no mínimo ou abaixo dele.` : "Nenhum produto ativo está abaixo do estoque mínimo.", cards: items.slice(0, 5).map((item) => ({ title: item.name, detail: `${item.stock} em estoque · mínimo ${item.minStock}`, href: `/admin/products/${item.id}`, tone: item.stock <= 0 ? "warning" : "default" })), sources: ["Produtos", "Estoque mínimo"], intent: "low_stock" };
  }

  if (/pedido|venda|pendente|aguardando/.test(query)) {
    const pending = data.orders.filter((order) => ["Novo", "Aguardando pagamento", "Pago", "Preparando"].includes(order.status));
    const total = pending.reduce((sum, order) => sum + order.total, 0);
    return { title: "Pedidos em acompanhamento", message: `${pending.length} pedido${pending.length === 1 ? "" : "s"} aguardam acompanhamento, somando R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`, cards: pending.slice(0, 5).map((order) => ({ title: order.code, detail: `${order.status} · R$ ${order.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, href: "/admin/orders" })), sources: ["Pedidos", "Status operacional"], intent: "pending_orders" };
  }

  if (/cashback|credito|venc/.test(query)) {
    const horizon = now.getTime() + 30 * 86_400_000;
    const expiring = data.cashbackEntries.filter((entry) => entry.remainingAmount > 0 && entry.expiresAt && new Date(entry.expiresAt).getTime() <= horizon && new Date(entry.expiresAt).getTime() >= now.getTime());
    const amount = expiring.reduce((sum, entry) => sum + entry.remainingAmount, 0);
    return { title: "Cashback com vencimento próximo", message: expiring.length ? `${expiring.length} crédito${expiring.length === 1 ? "" : "s"} somam R$ ${amount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} e vencem em até 30 dias.` : "Não há créditos de cashback vencendo nos próximos 30 dias.", cards: [{ title: "Abrir central de cashback", detail: "Consulte carteiras, campanhas e extratos.", href: "/admin/customers?cashback=1", tone: expiring.length ? "warning" : "positive" }], sources: ["Carteira de cashback", "Validade dos créditos"], intent: "cashback_expiring" };
  }

  if (/cliente|crm|relacionamento|tarefa/.test(query)) {
    const overdue = data.customerTasks.filter((task) => task.status === "open" && task.dueAt && new Date(task.dueAt).getTime() < now.getTime());
    return { title: "Prioridades de relacionamento", message: `${data.customers.length} clientes cadastrados e ${overdue.length} tarefa${overdue.length === 1 ? "" : "s"} atrasada${overdue.length === 1 ? "" : "s"}.`, cards: overdue.slice(0, 5).map((task) => ({ title: task.title, detail: `Responsável: ${task.assignedTo || "não definido"}`, href: "/admin/crm", tone: "warning" })), sources: ["Clientes", "Tarefas do CRM"], intent: "crm" };
  }

  if (/como|onde|ajuda|usar|funciona|tela/.test(query)) return routeHelp(route);

  return { title: "Posso consultar o painel", message: "Tente perguntar sobre estoque baixo, pedidos pendentes, cashback vencendo, tarefas do CRM ou como usar a tela atual.", cards: [{ title: "Ver relatórios", detail: "Análises consolidadas e exportações.", href: "/admin/reports" }, { title: "Ver central da equipe", detail: "Discussões, menções e aprovações.", href: "/admin/collaboration" }], sources: ["Base local segura do painel"], intent: "fallback" };
}

