# SPEC-003 — Pedidos com ciclo operacional e financeiro

## 1. Objetivo

Permitir que Junior acompanhe o andamento de um pedido sem confundir isso com a entrada do dinheiro.

## 2. Dimensões independentes

### Situação do pedido

`Novo`, `Em atendimento`, `Confirmado`, `Em preparação`, `Enviado`, `Entregue`, `Cancelado`.

### Situação do pagamento

`Pendente`, `Recebido`, `Parcial`, `Estornado`, `Cancelado`.

### Visibilidade

`Ativo` ou `Arquivado`. Cancelamentos recebem arquivamento programado para sete dias; o registro não é apagado.

## 3. Regras de negócio

- Preparar, enviar ou entregar exige pagamento recebido.
- Confirmar pagamento efetiva a entrada financeira, cashback e baixa física de estoque pelas rotinas existentes.
- Cancelar exige motivo.
- Cancelar antes do recebimento libera reserva e cashback previsto.
- Cancelar depois do recebimento devolve estoque, estorna financeiro e reverte cashback.
- Pedido cancelado não pode ser reaberto; deve-se criar outro pedido.
- Atualizações concorrentes são rejeitadas pela versão do ciclo.

## 4. Experiência de uso

- A lista possui filtros independentes de andamento e pagamento.
- O detalhe destaca um único próximo passo recomendado.
- Antes de salvar, o painel descreve os efeitos sobre caixa, estoque e cashback.
- Usuário sem permissão financeira pode atualizar o andamento, mas não o pagamento.

## 5. Compatibilidade e migração

- Pedidos `Novo` passam a `Novo/Pendente`.
- Pedidos `Pago` passam a `Em preparação/Recebido`.
- Pedidos `Entregue` passam a `Entregue/Recebido`.
- Pedidos `Cancelado` passam a `Cancelado/Cancelado` ou `Cancelado/Estornado` quando houver entrada financeira.
- O status legado permanece sincronizado para proteger integrações já existentes.

## 6. Testes obrigatórios

- Mapeamento de dados antigos.
- Próximo passo por etapa.
- Reconhecimento de receita somente para pagamento recebido.
- Cancelamento com e sem pagamento.
- Bloqueio de preparação sem recebimento.
- Motivo obrigatório e controle de concorrência.
- Fluxo de pedido em desktop e mobile.
