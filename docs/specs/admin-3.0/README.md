# Admin 3.0 — índice de implementação

Fonte de verdade atual: [Documento Mestre de Contexto v1.1](./JI_Admin_3_0_Documento_Mestre_de_Contexto_v1.1.docx), de 10/08/2026.

O documento v1.1 preserva o conteúdo da versão 1.0 e registra as decisões mais recentes. Em caso de conflito, prevalecem, nesta ordem: a SPEC específica mais nova, o adendo v1.1 do documento mestre e, por último, o texto original de 07/08/2026.

## Primeiro lançamento

- [SPEC-000 — Contrato global](./SPEC-000.md)
- [SPEC-001 — Navegação orientada à operação](./SPEC-001.md)
- [SPEC-003 — Pedidos com ciclo operacional e financeiro](./SPEC-003.md)

Esta entrega prioriza confiabilidade operacional: linguagem simples, menos decisões por tela, próximo passo evidente e separação entre andamento, pagamento e visibilidade. Compras/fornecedores e equipe/aprovações foram retirados da navegação, sem apagar seus dados.

## Admin 3.1 — implementado em 10/08/2026

- [SPEC-014 — Central de divergências e reconciliação](./SPEC-014.md)
- [SPEC-015 — Guardião financeiro de campanhas](./SPEC-015.md)
- [SPEC-016 — Programa de indicação e cashback](./SPEC-016.md)
- [SPEC-017 — Kits e produtos configuráveis](./SPEC-017.md)
- [SPEC-018 — Funil de conversão e recuperação de carrinhos](./SPEC-018.md)
- [SPEC-019 — Continuidade, observabilidade e recuperação](./SPEC-019.md)
- [SPEC-020 — Feature flags e publicação gradual](./SPEC-020.md)
- [SPEC-021 — Operação móvel, código de barras, voz e reversão](./SPEC-021.md)

## Decisões consolidadas no v1.1

- Status visíveis do pedido: **Novo**, **Pago**, **Entregue** e **Cancelado**; arquivamento é uma dimensão separada.
- Pagamentos integrais e parciais ficam no histórico financeiro do pedido sem criar novos status visuais.
- A loja registra o pedido e abre o WhatsApp configurado; não processa pagamento online e nunca envia mensagem automaticamente.
- O cashback usa como base o valor final pago pelos produtos, depois de descontos e sem frete.
- Campanha ativa substitui o cashback do produto; ajuste manual por pedido substitui ambos quando autorizado.
- Avaliações públicas de produtos permanecem fora do produto.
- O facilitador do Junior é o plugin privado do ChatGPT, com permissões, confirmação explícita e auditoria para mutações.

## Configurações operacionais ainda necessárias

- Percentuais, limites, janela e teto financeiro de cada campanha de indicação devem ser definidos pelo Junior no painel antes da ativação comercial.
- O kit degustação inicial foi configurado com quatro escolhas, repetição permitida até o limite do estoque e as opções unitárias ativas de 15 mg; a composição continua editável no painel.
- A margem mínima de cada campanha deve ser definida no Guardião financeiro; avisos exigem autorização de usuário com as permissões necessárias.
- RPO, RTO, retenção externa, uso de PITR e canal externo de alertas.
- As flags do Admin 3.1 foram publicadas para toda a operação por decisão de lançamento e permanecem disponíveis como kill switch.
- Regra definitiva de autenticação para consulta de cashback pelo cliente.

Os itens externos não impedem o funcionamento do Admin 3.1, mas devem ser concluídos para elevar a continuidade operacional ao nível máximo previsto na SPEC-019.
