# SPEC-000 — Contrato global do Admin 3.0

## 1. Objetivo

Transformar o painel em uma central de operação diária feita sob medida para a Junior Imports, preservando os dados e controles existentes.

## 2. Usuário principal

Proprietário e operadores da loja, inclusive pessoas sem formação técnica.

## 3. Princípios obrigatórios

1. Usar linguagem de negócio, não linguagem técnica.
2. Mostrar poucas decisões por tela e indicar o próximo passo.
3. Confirmar consequências antes de mudanças que afetem caixa, estoque ou cashback.
4. Manter auditoria e histórico; arquivar em vez de apagar.
5. Não automatizar mensagens externas sem confirmação humana.
6. Não misturar situação operacional, pagamento e visibilidade.
7. Mostrar o impacto financeiro, de estoque e de cashback antes de confirmar uma correção.
8. Liberar novidades de risco por etapas e permitir desligamento imediato.

## 4. Segurança e permissões

- O tenant é sempre validado no banco.
- Alterações financeiras exigem permissão `finance`.
- Alterações em pedidos exigem permissão `orders`.
- A versão do ciclo impede que uma tela antiga sobrescreva uma atualização mais recente.
- Auditoria de pedidos não replica dados pessoais do cliente.
- O plugin privado do ChatGPT usa as mesmas permissões do usuário conectado.
- Mutações solicitadas pelo plugin exigem resumo prévio, confirmação explícita, token pessoal de uso único e auditoria.
- Mensagens externas são apenas preparadas; nenhum fluxo envia WhatsApp automaticamente.

## 5. Contrato operacional vigente

- A interface apresenta somente os estados `Novo`, `Pago`, `Entregue` e `Cancelado`.
- Pagamentos parciais são lançamentos do histórico financeiro do pedido; não criam um quinto estado visível.
- `archived_at` controla a visibilidade sem apagar ou alterar o estado do pedido.
- Campos técnicos adicionais podem existir para compatibilidade interna, mas não podem reintroduzir complexidade na rotina do Junior.
- O estado legado continua sincronizado quando necessário para proteger checkout, estoque, caixa e cashback.

## 6. Critérios de aceite globais

- Fluxos funcionam em tema claro e escuro e em desktop/mobile.
- Nenhuma mudança quebra checkout, criação manual, estoque, cashback ou receita.
- Testes unitários, lint, tipos e build de produção passam antes do deploy.
- Migração é aditiva e preserva dados anteriores.
- Toda funcionalidade nova possui flag, plano de reversão e cenários de falha definidos antes da publicação geral.
