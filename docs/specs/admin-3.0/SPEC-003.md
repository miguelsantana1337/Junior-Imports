# SPEC-003 — Pedidos com ciclo operacional e financeiro

## 1. Contexto e problema

O Junior precisa acompanhar pedidos, receber em uma ou mais partes e manter caixa e estoque corretos sem lidar com estados técnicos demais.

## 2. Objetivo

Oferecer um ciclo simples e seguro, com quatro estados visíveis, pagamentos detalhados e arquivamento independente.

## 3. Estados visíveis

- `Novo`: pedido registrado e ainda não pago integralmente.
- `Pago`: soma dos pagamentos válidos atingiu o total vigente do pedido.
- `Entregue`: operação concluída após pagamento integral.
- `Cancelado`: pedido encerrado mediante motivo, com os efeitos necessários de liberação, estorno e reversão.
- `Arquivado`: atributo de visibilidade separado; não é status e não apaga o pedido.

## 4. Pagamentos integrais e parciais

- Cada pagamento registra valor, método, data, responsável, observação e chave de idempotência.
- O detalhe sempre mostra total vigente, total recebido, saldo restante e histórico.
- Um pagamento parcial mantém o pedido como `Novo` e atualiza apenas o saldo.
- Ao atingir exatamente o total, o pedido passa a `Pago` uma única vez.
- O sistema bloqueia pagamento acima do saldo, duplicado ou com valor não positivo.
- Ajustar o total do pedido exige motivo e mostra antes o efeito sobre saldo, receita, margem, cashback e estoque.
- Reduzir o total abaixo do que já foi recebido exige fluxo explícito de estorno ou crédito; nunca há correção silenciosa.

## 5. Estoque, caixa e cashback

- A confirmação integral reconhece receita e efetiva as rotinas de estoque e cashback uma única vez.
- Pagamento parcial reconhece somente o valor efetivamente recebido no caixa; não libera cashback definitivo.
- O cashback é calculado sobre o valor final pago pelos produtos, após descontos e sem frete.
- Campanha ativa substitui o cashback do produto; ajuste manual autorizado no pedido substitui ambos.
- Cancelamento antes do pagamento integral libera a reserva e remove cashback previsto.
- Cancelamento depois do pagamento integral executa estorno financeiro, devolução de estoque aplicável e reversão do cashback.
- Toda transição usa idempotência e transação para impedir baixa dupla ou receita duplicada.

## 6. Experiência de uso

- A lista filtra por `Novo`, `Pago`, `Entregue`, `Cancelado` e `Arquivado`.
- O detalhe destaca um próximo passo: registrar pagamento, quitar saldo, marcar como entregue, cancelar ou arquivar.
- Antes de salvar, o painel descreve os efeitos sobre caixa, estoque e cashback.
- Usuário sem permissão financeira pode consultar, mas não lançar pagamento, estorno ou ajuste de total.
- A interface funciona em desktop e mobile sem listas suspensas gigantes; busca de cliente e produto é incremental.

## 7. Arquivamento e concorrência

- Arquivar e desarquivar preserva valores, pagamentos, itens, auditoria e status.
- Pedido cancelado pode ser arquivado imediatamente ou por rotina configurável.
- Atualizações concorrentes são rejeitadas pela versão do ciclo e a tela exige recarregar os dados atuais.

## 8. Testes obrigatórios

- Pagamento integral único e em várias parcelas.
- Tentativa de pagamento duplicado, negativo, zero e acima do saldo.
- Ajuste de total maior e menor, inclusive abaixo do já recebido.
- Reconhecimento único de receita, estoque e cashback.
- Cancelamento com reserva, pagamento parcial e pagamento integral.
- Arquivar e desarquivar sem alterar o financeiro.
- Controle de concorrência e repetição idempotente.
- Fluxo completo em desktop e mobile.
