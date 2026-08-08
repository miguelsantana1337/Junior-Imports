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

## 4. Segurança e permissões

- O tenant é sempre validado no banco.
- Alterações financeiras exigem permissão `finance`.
- Alterações em pedidos exigem permissão `orders`.
- A versão do ciclo impede que uma tela antiga sobrescreva uma atualização mais recente.
- Auditoria de pedidos não replica dados pessoais do cliente.

## 5. Compatibilidade

O campo legado `status` continua sincronizado para as rotinas consolidadas de estoque, caixa e cashback. As novas interfaces usam `operational_status`, `payment_status` e `archived_at`.

## 6. Critérios de aceite globais

- Fluxos funcionam em tema claro e escuro e em desktop/mobile.
- Nenhuma mudança quebra checkout, criação manual, estoque, cashback ou receita.
- Testes unitários, lint, tipos e build de produção passam antes do deploy.
- Migração é aditiva e preserva dados anteriores.
