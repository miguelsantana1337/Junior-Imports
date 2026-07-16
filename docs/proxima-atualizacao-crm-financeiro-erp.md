# Próxima atualização — CRM, financeiro e ERP integrados

**Projeto:** Junior Imports
**Escopo confirmado:** CRM completo, financeiro completo e funções centrais de ERP.
**Interpretação:** “RP” foi tratado como **ERP**, conforme a conversa anterior.

## Objetivo da versão

Transformar o painel atual em um centro operacional único. Clientes, pedidos, estoque, compras e financeiro devem compartilhar os mesmos dados para que uma venda atualize automaticamente o histórico do cliente, a disponibilidade do produto, o custo da mercadoria, o contas a receber e os indicadores de resultado.

O princípio da versão é evitar lançamentos duplicados. Um pedido deve ser a origem de todos os eventos relacionados, com trilha de auditoria e possibilidade de ajuste controlado.

## 1. CRM completo

### Operação diária

- fila “Hoje” com contatos atrasados, retornos, clientes em risco e recompras previstas;
- tarefas com responsável, prazo, prioridade, motivo, resultado e lembrete;
- carteira de clientes por vendedor e transferência de responsável;
- registro de contatos por WhatsApp, telefone, Instagram e e-mail;
- próxima ação recomendada e próxima compra prevista;
- notificações de tarefas vencidas e oportunidades sem acompanhamento.

### Cliente 360

- página própria, substituindo o modal atual;
- abas Visão geral, Pedidos, Conversas, Tarefas, Cupons, Financeiro e Dados;
- timeline única de pedidos, contatos, mensagens, tarefas, cupons e alterações;
- ticket médio, frequência, total gasto, margem gerada e produtos preferidos;
- endereços, etiquetas, notas, origem e campanha de aquisição;
- criação rápida de pedido, tarefa, cupom ou contato a partir do cliente.

### Segmentação e campanhas

- regras configuráveis para VIP, recorrente, em risco e inativo;
- segmentos salvos por período, produto, categoria, cidade, ticket e frequência;
- públicos como “sem comprar há 60 dias” ou “recompra prevista nesta semana”;
- campanhas com público, mensagem, responsável, custo e receita atribuída;
- ações em massa para etiquetar, atribuir, criar tarefa, exportar e iniciar campanha;
- limites e consentimentos por canal, com opt-out respeitado automaticamente.

### Qualidade, segurança e LGPD

- detecção de duplicidade por e-mail e telefone;
- tela segura para mesclar ou separar clientes;
- mascaramento de dados pessoais conforme permissão;
- consentimento, origem, data e versão do aceite;
- exportação, anonimização e política de retenção;
- paginação e filtros executados no banco;
- trilha de acesso e alteração de dados sensíveis.

## 2. Financeiro completo

### Custo e rentabilidade por produto

- custo atual no cadastro do produto;
- histórico de custo com data, fornecedor e documento de origem;
- custo médio ponderado após cada entrada de estoque;
- custo congelado no item do pedido para preservar o resultado histórico;
- despesas variáveis por venda: frete subsidiado, embalagem, taxas, comissão e impostos configuráveis;
- cálculo automático de lucro bruto, margem de contribuição e lucro líquido estimado;
- simulador de preço com custo, margem desejada e preço mínimo recomendado.

### Fluxo financeiro

- contas financeiras: caixa, banco, Pix e outras carteiras;
- entradas e saídas manuais;
- contas a pagar e a receber com vencimento, competência, pagamento e situação;
- lançamentos recorrentes;
- categorias e centros de custo;
- anexos e comprovantes;
- parcelamento e baixas parciais;
- conciliação entre pedido, recebimento e conta financeira;
- estorno, cancelamento e ajuste com motivo obrigatório;
- fechamento de período para impedir alterações retroativas não autorizadas.

### Relatórios

- fluxo de caixa realizado e previsto;
- DRE gerencial por período;
- receita, custo, despesas e lucro líquido;
- margem por produto, categoria, cliente e canal;
- contas vencidas, a vencer e inadimplência;
- comissão por vendedor;
- comparação mensal e metas;
- exportação CSV/XLSX e impressão de relatórios.

### Dashboard financeiro

- saldo disponível;
- receita do período;
- lucro líquido e margem;
- contas a receber e a pagar;
- caixa projetado para 7, 30 e 90 dias;
- produtos com melhor e pior margem;
- alertas de despesas fora do padrão e pedidos sem conciliação.

## 3. Funções de ERP

### Estoque e rastreabilidade

- razão de movimentos: entrada, saída, reserva, venda, devolução, perda e ajuste;
- saldo por depósito ou local de armazenamento;
- estoque disponível, reservado e físico;
- estoque mínimo, máximo e ponto de reposição;
- inventário físico com contagem, divergência e aprovação;
- transferências entre locais;
- lotes, validade e rastreabilidade de origem;
- alertas de validade próxima, ruptura e excesso de estoque;
- bloqueio de lote e suporte a recolhimento;
- histórico completo por SKU, lote, usuário e documento.

### Fornecedores e compras

- cadastro de fornecedores, contatos, prazo, condições e avaliação;
- tabela de preços e histórico de compras;
- solicitação e ordem de compra;
- itens, descontos, frete, impostos e custo total da compra;
- recebimento parcial ou total;
- conferência de quantidade, lote, validade e custo;
- divergências e devolução ao fornecedor;
- contas a pagar geradas a partir do recebimento;
- sugestão de compra com base em estoque mínimo e ritmo de venda.

### Pedidos e pós-venda

- timeline de eventos do pedido;
- reserva e baixa de estoque por status;
- separação, conferência, expedição e rastreio;
- devolução, troca, cancelamento e estorno;
- motivo e responsável por cada exceção;
- impressão de lista de separação e etiquetas;
- indicadores de tempo entre pedido, confirmação, envio e entrega.

### Catálogo operacional

- variantes quando necessárias;
- código de barras e SKU único;
- cadastro e estoque em massa por planilha, já iniciado no sistema;
- atualização de custo em massa;
- ações em massa de preço, categoria, status e estoque;
- log de importação, erros por linha e reversão controlada.

## 4. Arquitetura integrada

### Entidades principais

- CRM: `customer_tasks`, `customer_contacts`, `customer_activities`, `customer_assignments`, `customer_consents`, `customer_segments`, `campaigns` e `campaign_members`;
- financeiro: `financial_accounts`, `financial_categories`, `financial_transactions`, `accounts_receivable`, `accounts_payable`, `cost_centers`, `reconciliations` e `period_closures`;
- custos: `product_cost_history` e custo congelado em `order_items`;
- ERP: `warehouses`, `inventory_balances`, `inventory_movements`, `product_lots`, `suppliers`, `purchase_orders`, `purchase_order_items`, `goods_receipts`, `returns` e `order_events`.

### Regras indispensáveis

- saldos financeiros e de estoque serão derivados de movimentos auditáveis, não de edição direta;
- cada operação terá `tenant_id`, usuário, data, origem e idempotência;
- RLS do Supabase impedirá acesso entre lojas e áreas não autorizadas;
- operações críticas usarão transações no banco;
- cancelamento gera movimento reverso, sem apagar o histórico;
- custos e totais históricos permanecem congelados no pedido;
- exclusões críticas serão lógicas, com motivo e auditoria.

## 5. Navegação e experiência do painel

### Estrutura sugerida

- **Visão geral:** saúde da operação e pendências;
- **CRM:** Hoje, Clientes, Tarefas, Segmentos e Campanhas;
- **Vendas:** Pedidos, Separação, Entregas e Devoluções;
- **Estoque:** Visão geral, Movimentos, Inventário, Lotes e Importações;
- **Compras:** Fornecedores, Ordens de compra e Recebimentos;
- **Financeiro:** Dashboard, Lançamentos, Contas a pagar, Contas a receber, Conciliação e Relatórios;
- **Loja:** Produtos, Categorias, Conteúdo, Banners e Layout;
- **Sistema:** Usuários, Permissões, Auditoria e Configurações.

### Padrões de UI

- página inicial de cada módulo com resumo, alertas e ação principal;
- filtros persistentes e busca global;
- tabelas no desktop e cards operacionais no mobile;
- ações em massa somente após seleção explícita;
- formulários com salvamento seguro, validação por campo e prevenção de perda de dados;
- estados vazios explicativos e erros com instrução de correção;
- atalhos rápidos sem duplicar a navegação lateral;
- acessibilidade por teclado, foco visível e alvos de toque de pelo menos 44 px.

## 6. Permissões

As permissões atuais por módulo precisam ser ampliadas para ações específicas:

- CRM: visualizar, editar, exportar, ver dados pessoais, enviar mensagem e gerenciar campanhas;
- financeiro: visualizar, lançar, aprovar, conciliar, fechar período e exportar;
- estoque: visualizar, movimentar, ajustar, inventariar e gerenciar lotes;
- compras: solicitar, aprovar, receber e cancelar;
- pedidos: visualizar, alterar status, cancelar, devolver e estornar;
- relatórios: visualizar dados consolidados e exportar;
- administração: usuários, papéis, políticas e auditoria.

Operações sensíveis poderão exigir dupla aprovação, especialmente ajuste de estoque, estorno, exclusão, fechamento e pagamento.

## 7. Etapas de implementação

### Etapa 0 — jornada de compra

- correção do CTA de adicionar ao carrinho;
- confirmação explícita no WhatsApp;
- teste desktop e mobile.

### Etapa 1 — fundação de dados e permissões

- novas tabelas, índices, RLS e auditoria;
- permissões granulares;
- eventos de pedido, estoque e financeiro;
- migrações e dados demonstrativos.

### Etapa 2 — ERP de estoque e compras

- movimentos, saldos, lotes, validade e inventário;
- fornecedores, ordens de compra e recebimentos;
- integração automática com custos e contas a pagar.

### Etapa 3 — financeiro

- custos, lançamentos, contas, conciliação, fluxo de caixa e DRE;
- indicadores de margem e lucro;
- exportações e fechamento de período.

### Etapa 4 — CRM operacional

- página 360, timeline, tarefas, responsáveis e fila Hoje;
- segmentos, campanhas, consentimentos e ações em massa;
- métricas de recompra e receita recuperada.

### Etapa 5 — integração e estabilização

- automações entre pedido, cliente, estoque e financeiro;
- testes de permissão, concorrência, cálculos e acessibilidade;
- observabilidade, alertas e tratamento de falhas;
- homologação com cenários reais do Júnior.

## 8. Critério de conclusão

A versão será considerada completa quando o Júnior conseguir:

1. ver quem precisa de atendimento e qual é o próximo passo;
2. acompanhar todo o histórico do cliente e do pedido;
3. saber estoque disponível, reservado, lote e validade;
4. gerar e receber uma compra de fornecedor;
5. conhecer custo, margem e lucro de cada venda;
6. controlar entradas, saídas, contas e caixa projetado;
7. rastrear qualquer ajuste até o usuário e documento de origem;
8. operar as funções principais pelo celular sem depender de planilhas paralelas;
9. restringir cada usuário somente às ações autorizadas;
10. exportar relatórios confiáveis para conferência e decisão.

## Decisões que precisam ser confirmadas antes da construção completa

- quais meios de pagamento serão apenas informativos e quais precisarão de conciliação real;
- se haverá mais de um local de estoque;
- se lote e validade serão obrigatórios para todos os produtos ou apenas categorias definidas;
- quais usuários podem aprovar ajustes, compras, pagamentos e estornos;
- se WhatsApp será somente abertura de conversa ou integração oficial com envio e retorno de status;
- se emissão fiscal e integrações contábeis entram nesta versão ou ficam para uma fase posterior.
