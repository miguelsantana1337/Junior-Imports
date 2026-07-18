# Roadmap de execução do painel administrativo

Atualizado em 18/07/2026. Este documento transforma a lista aprovada em entregas verificáveis e evita duplicar recursos que já existem no sistema.

## Escopo confirmado

- O site não processará pagamentos por enquanto.
- Entrega e cálculo de frete não fazem parte desta etapa.
- A IA começa em modo de consulta e sugestão. Ações que alterem dados exigirão confirmação, permissão e auditoria.

## Legenda

- **Concluído:** funcional e integrado.
- **Em execução:** iniciado no código, com entrega incremental.
- **Parcial:** existe uma base funcional, mas ainda faltam capacidades da lista.
- **Planejado:** ainda não iniciado.
- **Dependência externa:** exige credencial, serviço ou decisão operacional.

## 1. Fundação, segurança e confiabilidade

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Supabase em produção e eliminação da dependência de demo | Concluído | Acompanhar a Central de saúde e manter o bloqueio de demo em produção. |
| RLS multiempresa e isolamento por tenant | Concluído | Manter testes de regressão a cada migration. |
| Chaves administrativas somente no servidor | Concluído | Manter varredura de segredos no CI. |
| Auditoria com valores antes/depois | Concluído | Manter testes de mascaramento e ampliar a timeline por entidade. |
| Backup, restauração e contingência | Parcial | Backup criptografado, checksum, restauração controlada e runbook concluídos; falta contratar guarda externa/PITR. |
| Monitoramento e alertas | Parcial | Central de saúde acompanha banco, Auth, auditoria, backup e deploy; falta canal externo de alertas. |
| Testes unitários e E2E | Parcial | Expandir fluxos críticos e incluir a central de comandos. |
| Privacidade e termos | Parcial | Revisão jurídica e versionamento dos termos aceitos. |

## 2. Produtividade e personalização

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Central de comandos com `Cmd/Ctrl + K` | Concluído | Expandir fontes conforme novos módulos forem entregues. |
| Favoritos | Concluído | Expandir fontes conforme novos módulos forem entregues. |
| Preferências persistentes | Concluído | Manter compatibilidade de versões. |
| Visualizações e filtros salvos | Parcial | Catálogo concluído; expandir para clientes e pedidos. |
| Densidade e colunas das tabelas | Parcial | Densidade do catálogo neste lote; seletor de colunas depois. |
| Autosave e indicador de status | Parcial | Editor de produto já salva rascunho; padronizar nos demais editores. |
| Desfazer e refazer | Planejado | Criar histórico reversível para operações compatíveis. |
| Painel lateral de edição rápida | Planejado | Começar por produto, cliente e pedido. |
| Editor em massa tipo planilha | Parcial | Importação existe; falta edição inline e validação em lote. |
| Dashboard personalizável | Planejado | Widgets, ordem, tamanho e preferências por usuário. |

## 3. Interação, drag and drop e acessibilidade

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Reordenação de seções, banners e imagens | Concluído | Adicionar menu de posição e anúncios para leitores de tela. |
| Animação de reordenação e restauração de foco | Parcial | Melhorar feedback de teclado e acessibilidade. |
| Dashboard arrastável | Planejado | Depende da base de widgets personalizáveis. |
| Kanban de pedidos | Planejado | Criar visão alternativa sem substituir a tabela. |

## 4. Clientes, cashback e recompra

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Cliente 360 | Concluído | Evoluir comunicações e histórico compartilhado no Lote 4. |
| Cashback por produto e total por pedido | Concluído | Acompanhar conversão e custo das campanhas. |
| Carteira, extrato, validade e ajustes | Concluído | Ledger imutável, consumo FIFO e ajustes auditáveis disponíveis. |
| Campanhas e segmentos de cashback | Concluído | Integrar ao calendário unificado do Lote 4. |
| Indicadores e alertas de recompra | Concluído | Conectar alertas ao calendário e às automações do Lote 4. |

## 5. Marketing, publicação e automação

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Banners, cupons e mensagens | Concluído | Adicionar agendamento, aprovação e calendário. |
| Calendário de campanhas | Planejado | Visão única para banners, cupons, cashback e mensagens. |
| Templates e simulação | Parcial | Mensagens têm simulação; falta biblioteca versionada. |
| Rascunho, revisão, preview e publicação | Parcial | Editor da loja tem preview; falta workflow compartilhado e rollback. |
| Construtor de regras | Planejado | Gatilhos, condições, ações, teste, pausa, retry e logs. |

## 6. Catálogo, estoque e compras

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Estoque, lotes, fornecedores e compras | Concluído | Evoluir análises e sugestões. |
| Previsão de ruptura e sugestão de compra | Planejado | Usar giro, estoque mínimo e lead time. |
| Baixo giro, margem e inconsistências | Parcial | Margem existe no financeiro; falta central de alertas do catálogo. |
| Leitura de código de barras no celular | Planejado | PWA com câmera e confirmação de produto. |
| Importação em massa | Concluído | Adicionar templates, histórico detalhado e reversão. |
| Histórico de mudanças por produto | Parcial | Auditoria geral existe; falta timeline no produto. |

## 7. Equipe e colaboração

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Papéis, permissões e MFA | Concluído | Revisões periódicas de acesso. |
| Tarefas e responsáveis | Parcial | CRM possui tarefas; falta caixa de entrada unificada. |
| Comentários, menções e aprovações | Planejado | Thread auditável por entidade. |
| Usuários online e edição concorrente | Planejado | Presença e bloqueio otimista no Supabase. |

## 8. Relatórios e integrações

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Métricas operacionais e financeiras | Parcial | Criar construtor e comparativos por período. |
| Exportação CSV, Excel e PDF | Parcial | JSON e planilhas de importação existem; falta central de exportações. |
| Relatórios salvos e compartilhados | Planejado | Preferências e permissões por usuário. |
| Status de Supabase, WhatsApp, e-mail e IA | Planejado | Health center, teste, último sync e logs. |

## 9. Copiloto Junior

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Painel lateral do chat | Planejado | Interface contextual e histórico de sessão. |
| Ajuda sobre o software | Planejado | Base de conhecimento das telas e processos. |
| Consulta a produtos, clientes, pedidos, estoque e cashback | Dependência externa | Implementar após disponibilização segura da chave da API. |
| Cards, links profundos, resumos e sugestões | Planejado | Começar somente leitura. |
| Ações com confirmação, RBAC, auditoria e desfazer | Planejado | Liberar apenas após avaliação da fase somente leitura. |
| Transparência de dados e limite de custos | Planejado | Tela de política, consumo e limites por usuário. |

## 10. Experiência premium e qualidade

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Motion, splash, transições e feedback de navegação | Concluído | Splash restrita à primeira abertura da sessão. |
| Skeletons e carregamento em segundo plano | Parcial | Padronizar por rota e eliminar esperas artificiais. |
| Empty states e ajuda contextual | Parcial | Cobrir todas as páginas e ações sem dados. |
| Tour, changelog e central de saúde | Parcial | Central de saúde concluída; tour e changelog seguem planejados. |
| PWA | Concluído | Ampliar suporte offline apenas para leitura segura. |
| Performance e acessibilidade reais | Em execução | Validar teclado, contraste, mobile e E2E a cada lote. |

## Ordem dos próximos lotes

1. **Lote 1 — concluído:** central de comandos, favoritos, preferências, filtros salvos e auditoria visual.
2. **Lote 2 — concluído nesta entrega:** health center, proteção contra demo em produção, backup/restore e monitoramento interno.
3. **Lote 3 — concluído nesta entrega:** carteira/extrato de cashback, campanhas segmentadas e Cliente 360.
4. **Lote 4:** calendário de campanhas, workflow de publicação e construtor de automações.
5. **Lote 5:** análises de estoque, relatórios e exportações.
6. **Lote 6:** colaboração de equipe e Copiloto Junior em modo somente leitura.
