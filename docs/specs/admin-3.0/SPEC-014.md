# SPEC-014 — Central de divergências e reconciliação

## 1. Contexto e problema

Pedido, pagamento, caixa, estoque e cashback participam da mesma venda, mas podem divergir quando uma ação falha, é repetida ou ocorre fora da ordem esperada. O painel precisa identificar a causa e orientar uma correção segura antes que o erro afete a rotina.

## 2. Objetivo

Criar uma fila única de inconsistências, com evidência, impacto, correção proposta, confirmação e auditoria.

## 3. Usuários e permissões

- Operadores podem visualizar divergências de pedidos e estoque conforme suas permissões.
- Somente usuários com `finance` visualizam valores financeiros detalhados e executam correções de caixa.
- Correções que afetam mais de um domínio exigem todas as permissões correspondentes.
- O plugin do ChatGPT pode consultar e preparar a correção, mas só executa após confirmação explícita com token pessoal de uso único.

## 4. Divergências mínimas

- Pedido `Pago` sem movimento definitivo de estoque.
- Pedido `Entregue` com saldo a receber.
- Pagamento registrado sem entrada financeira correspondente.
- Baixa ou devolução duplicada de estoque.
- Pedido cancelado mantendo reserva ativa.
- Cashback liberado antes do pagamento integral.
- Cashback calculado com base, regra ou valor incompatível.
- Total vigente do pedido diferente do valor reconhecido no financeiro.
- Kit com componentes reservados ou baixados de forma incompleta.
- Indicação premiada sem primeira compra integralmente paga ou depois de cancelamento.

## 5. Detecção e estados

- Regras determinísticas rodam após eventos críticos e também em varredura agendada.
- Cada ocorrência possui severidade `Crítica`, `Alta`, `Média` ou `Baixa`.
- Estados: `Aberta`, `Em análise`, `Correção preparada`, `Resolvida`, `Ignorada com motivo` e `Reaberta`.
- Ocorrências idênticas para a mesma entidade são agrupadas; não criam notificações duplicadas.
- A fila mostra idade, entidades afetadas, impacto estimado e responsável.

## 6. Fluxo de correção

1. O usuário abre a divergência e vê o que aconteceu, o esperado e as evidências.
2. O sistema calcula uma correção proposta sem alterar dados.
3. A prévia mostra efeitos em pedido, caixa, estoque e cashback.
4. O usuário informa motivo e confirma.
5. A correção executa em transação e com chave de idempotência.
6. O sistema reavalia a regra e só encerra a divergência quando a consistência foi comprovada.

Não existe botão genérico “corrigir tudo”. Correção em lote somente para ocorrências homogêneas, com seleção explícita, prévia consolidada e permissão reforçada.

## 7. Dados e auditoria

Registrar identificador da regra, tenant, entidades, evidência mínima, hash do estado observado, severidade, impacto, correção proposta, valores antes/depois, responsável, motivo, confirmação, resultado e timestamps.

Dados pessoais não necessários à explicação são mascarados. A auditoria da correção é imutável e ligada à auditoria original que causou a divergência quando houver.

## 8. Experiência de uso

- A página **Hoje** destaca no máximo três divergências prioritárias.
- A central oferece filtros por domínio, severidade, estado, idade e responsável.
- Cada cartão usa linguagem simples: “O pedido JI-0000 está pago, mas o estoque não foi baixado”.
- O sistema explica o próximo passo e por que ele é seguro.
- Tema claro/escuro, teclado e mobile precisam manter toda a evidência legível.

## 9. Critérios de aceite

- Cada cenário mínimo é detectado sem falso encerramento.
- A mesma falha repetida não duplica efeitos nem ocorrências abertas.
- Nenhuma correção é aplicada sem prévia, motivo, permissão e confirmação.
- A resolução comprova a consistência depois da transação.
- Falha parcial executa rollback e mantém a ocorrência aberta.
- Toda mudança pode ser rastreada até o usuário, a regra e a entidade afetada.

## 10. Testes obrigatórios

- Unidade para cada regra de divergência.
- Integração com pedidos, pagamentos, financeiro, estoque, cashback, kits e indicações.
- Concorrência e repetição idempotente.
- Permissões, mascaramento e isolamento por tenant.
- Correção com sucesso, rollback, ocorrência ignorada e reabertura.
- Fluxo E2E no painel e pelo plugin privado do ChatGPT.

## 11. Fora de escopo

- Correções automáticas sem confirmação humana.
- Exclusão de auditorias ou pedidos para “limpar” a divergência.
- Uso de modelo de IA para decidir sozinho qual valor financeiro é correto.
