import type {
  Order,
  OrderOperationalStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/types/store";

export const operationalOrderStatuses: readonly OrderOperationalStatus[] = [
  "Novo",
  "Em atendimento",
  "Confirmado",
  "Em preparação",
  "Enviado",
  "Entregue",
  "Cancelado",
];

export const orderPaymentStatuses: readonly OrderPaymentStatus[] = [
  "Pendente",
  "Recebido",
  "Parcial",
  "Estornado",
  "Cancelado",
];

export function orderOperationalStatus(order: Pick<Order, "operationalStatus" | "status">): OrderOperationalStatus {
  if (order.operationalStatus && operationalOrderStatuses.includes(order.operationalStatus)) {
    return order.operationalStatus;
  }
  if (order.status === "Pago") return "Em preparação";
  return order.status;
}

export function orderPaymentStatus(order: Pick<Order, "paymentStatus" | "status">): OrderPaymentStatus {
  if (order.paymentStatus && orderPaymentStatuses.includes(order.paymentStatus)) return order.paymentStatus;
  if (order.status === "Pago" || order.status === "Entregue") return "Recebido";
  if (order.status === "Cancelado") return "Cancelado";
  return "Pendente";
}

export function legacyStatusForLifecycle(
  operationalStatus: OrderOperationalStatus,
  paymentStatus: OrderPaymentStatus,
): OrderStatus {
  if (operationalStatus === "Cancelado") return "Cancelado";
  // Um pedido pode ser entregue por decisão do proprietário antes da
  // quitação. Nesse caso, o status legado não pode indicar recebimento, pois
  // rotinas antigas ainda usam "Entregue" como sinônimo de venda paga.
  if (operationalStatus === "Entregue" && paymentStatus === "Recebido") return "Entregue";
  if (paymentStatus === "Recebido") return "Pago";
  return "Novo";
}

export type OrderNextAction = {
  label: string;
  description: string;
  operationalStatus?: OrderOperationalStatus;
  paymentStatus?: OrderPaymentStatus;
  archive?: boolean;
};

export function nextOrderAction(order: Pick<Order, "operationalStatus" | "paymentStatus" | "status">): OrderNextAction | null {
  const operationalStatus = orderOperationalStatus(order);
  const paymentStatus = orderPaymentStatus(order);

  if (operationalStatus === "Cancelado") return { label: "Arquivar pedido", description: "Retira o pedido da fila sem apagar o histórico.", archive: true };
  if (operationalStatus === "Entregue" && paymentStatus !== "Recebido") {
    return { label: "Registrar pagamento", description: "O pedido foi entregue, mas o saldo ainda está em aberto.", paymentStatus: "Recebido" };
  }
  if (operationalStatus === "Entregue") return { label: "Finalizar e arquivar", description: "Conclui a operação e preserva o pedido nos relatórios.", archive: true };
  if (operationalStatus === "Enviado") return { label: "Marcar como entregue", description: "Confirma que a entrega foi concluída.", operationalStatus: "Entregue" };
  if (operationalStatus === "Em preparação") return { label: "Marcar como enviado", description: "Registra que o pedido saiu para entrega.", operationalStatus: "Enviado" };
  if (paymentStatus === "Recebido") return { label: "Preparar pedido", description: "O pagamento foi recebido e o pedido pode ser separado.", operationalStatus: "Em preparação" };
  if (operationalStatus === "Confirmado") return { label: "Confirmar pagamento", description: "Registra a entrada, efetiva o cashback e baixa o estoque físico.", paymentStatus: "Recebido" };
  if (operationalStatus === "Em atendimento") return { label: "Confirmar pedido", description: "Os dados foram conferidos e o pedido ficará aguardando pagamento.", operationalStatus: "Confirmado" };
  if (operationalStatus === "Novo") return { label: "Confirmar atendimento", description: "Registra que você começou a cuidar deste pedido.", operationalStatus: "Em atendimento" };
  return null;
}

export function lifecycleChangeConsequences(
  current: Pick<Order, "operationalStatus" | "paymentStatus" | "status">,
  nextOperationalStatus: OrderOperationalStatus,
  nextPaymentStatus: OrderPaymentStatus,
) {
  const consequences: string[] = [];
  const currentOperational = orderOperationalStatus(current);
  const currentPayment = orderPaymentStatus(current);

  if (currentPayment !== "Recebido" && nextPaymentStatus === "Recebido") {
    consequences.push("O valor entrará no caixa, o cashback será efetivado e o estoque físico será baixado.");
  }
  if (currentOperational !== "Cancelado" && nextOperationalStatus === "Cancelado") {
    consequences.push(currentPayment === "Recebido" || currentPayment === "Parcial"
      ? "O estoque será devolvido, o financeiro será estornado e o cashback será revertido."
      : "A reserva de estoque e o cashback previsto serão liberados.");
  }
  if (nextOperationalStatus === "Em preparação") consequences.push("O pedido passará para a fila de preparação.");
  if (nextOperationalStatus === "Enviado") consequences.push("O pedido ficará aguardando a confirmação da entrega.");
  if (nextOperationalStatus === "Entregue" && nextPaymentStatus === "Recebido") {
    consequences.push("O ciclo será concluído e a contagem de recompra será iniciada.");
  }
  if (nextOperationalStatus === "Entregue" && nextPaymentStatus !== "Recebido") {
    consequences.push("O pedido será entregue com saldo em aberto, o estoque será baixado e o valor continuará pendente no financeiro.");
    consequences.push("Somente o proprietário pode autorizar esta exceção e o motivo ficará registrado no pedido.");
  }
  if (!consequences.length) consequences.push("A situação operacional será atualizada e ficará registrada na auditoria.");
  return consequences;
}

export function lifecycleReasonRequired(
  current: Pick<Order, "operationalStatus" | "paymentStatus" | "status">,
  nextOperationalStatus: OrderOperationalStatus,
  nextPaymentStatus: OrderPaymentStatus,
) {
  return orderOperationalStatus(current) !== "Cancelado" && nextOperationalStatus === "Cancelado"
    || orderPaymentStatus(current) !== nextPaymentStatus && ["Estornado", "Cancelado"].includes(nextPaymentStatus)
    || nextOperationalStatus === "Entregue" && nextPaymentStatus !== "Recebido";
}
