# Roadmap de execução do painel administrativo

Atualizado em 10/08/2026. O histórico dos lotes concluídos em 18/07/2026 foi preservado; o bloco **Próximo ciclo — Admin 3.1** registra a direção mais recente.

## Escopo confirmado

- O site não processará pagamentos por enquanto; registra o pedido e abre o WhatsApp configurado.
- Não haverá integração automática com transportadora nesta etapa; frete e retirada seguem as regras configuradas na loja.
- O facilitador do Junior é o plugin privado do ChatGPT. Ações que alterem dados exigem confirmação explícita, permissão e auditoria.
- WhatsApp nunca é enviado automaticamente: o sistema prepara o texto e o link para revisão humana.

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
| Banners, cupons e mensagens | Concluído | Medir conversão e custo por campanha nos próximos lotes. |
| Calendário de campanhas | Concluído | Visão única para banners, cupons, cashback, mensagens e campanhas coordenadas. |
| Templates e simulação | Concluído | Placeholders, preview por pedido e simulação segura com histórico. |
| Rascunho, revisão, preview e publicação | Concluído | Workflow compartilhado com aprovação, agendamento, versões e rollback. |
| Construtor de regras | Concluído | Gatilhos, condições, ações combinadas, teste, pausa, retry e logs. |

## 6. Catálogo, estoque e compras

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Estoque, lotes, fornecedores e compras | Concluído | Evoluir análises e sugestões. |
| Previsão de ruptura e sugestão de compra | Concluído | Radar usa giro, estoque mínimo, compras em trânsito e lead time; gera rascunho revisável. |
| Baixo giro, margem e inconsistências | Concluído | Fila priorizada por risco, ausência de giro, margem baixa e inconsistências cadastrais. |
| Leitura de código de barras no celular | Concluído | Leitor por gesto do usuário, associação confirmada e fallback manual disponíveis na Central operacional. |
| Importação em massa | Concluído | Adicionar templates, histórico detalhado e reversão. |
| Histórico de mudanças por produto | Parcial | Auditoria geral existe; falta timeline no produto. |

## 7. Equipe e colaboração

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Papéis, permissões e MFA | Concluído | Revisões periódicas de acesso. |
| Tarefas e responsáveis | Concluído | Caixa unificada combina tarefas do CRM, menções e decisões pendentes. |
| Comentários, menções e aprovações | Concluído | Threads por entidade, menções, decisões e auditoria protegida por tenant. |
| Usuários online e edição concorrente | Concluído | Presença em tempo real e lease de edição aplicado ao cadastro de produto. |

## 8. Relatórios e integrações

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Métricas operacionais e financeiras | Concluído | Construtor cobre vendas, financeiro, estoque, clientes, cashback e compras com comparativo. |
| Exportação CSV, Excel e PDF | Concluído | Arquivos reais, cabeçalhos preservados e histórico auditável por usuário. |
| Relatórios salvos e compartilhados | Concluído | Configurações persistidas, compartilhamento e permissão específica de relatórios. |
| Status de Supabase, WhatsApp, e-mail e IA | Parcial | Saúde operacional e alertas internos ativos; falta configurar o canal externo escolhido. |

## 9. Assistente Junior e plugin privado

| Item | Status | Próxima entrega |
| --- | --- | --- |
| Painel lateral do chat | Concluído | Interface contextual, atalho Cmd/Ctrl + J e histórico seguro da sessão. |
| Ajuda sobre o software | Concluído | Base local auditável orienta telas e processos principais. |
| Consulta a produtos, clientes, pedidos, estoque e cashback | Concluído | Plugin privado conectado às ferramentas autorizadas do backend. |
| Cards, links profundos, resumos e sugestões | Concluído | Respostas locais exibem cards e atalhos sem executar mutações. |
| Ações com confirmação, RBAC e auditoria | Concluído | Toda mutação usa prévia e confirmação explícita; ampliar ferramentas somente por feature flag. |
| Transparência de dados e limite de custos | Parcial | Fontes visíveis, zero envio externo e telemetria local; limites monetários entram com a API. |

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
4. **Lote 4 — concluído nesta entrega:** calendário de campanhas, workflow de publicação e construtor de automações.
5. **Lote 5 — concluído nesta entrega:** análises de estoque, relatórios comparativos, configurações salvas e exportações CSV, Excel e PDF.
6. **Lote 6 — concluído nesta entrega:** colaboração de equipe, presença, edição concorrente e Copiloto Junior em modo somente leitura.

## Admin 3.1 — implementado e publicado

| Ordem | Entrega | Resultado esperado | SPEC |
| --- | --- | --- | --- |
| 1 | Central de divergências | Concluído: detecção, evidência, prévia, confirmação, motivo, correção segura e auditoria. | [SPEC-014](./specs/admin-3.0/SPEC-014.md) |
| 2 | Guardião financeiro de campanhas | Concluído: simulação obrigatória de preço, desconto, cashback, custo e margem. | [SPEC-015](./specs/admin-3.0/SPEC-015.md) |
| 3 | Continuidade operacional | Parcial externo: central, cron e alertas internos concluídos; cópia externa e canal externo dependem de configuração. | [SPEC-019](./specs/admin-3.0/SPEC-019.md) |
| 4 | Programa de indicação | Concluído: código, vínculo, antifraude, recompensa após quitação, estorno e bônus manual. | [SPEC-016](./specs/admin-3.0/SPEC-016.md) |
| 5 | Kits configuráveis | Concluído: kit degustação ativo, seleção de quatro ampolas e estoque por componente. | [SPEC-017](./specs/admin-3.0/SPEC-017.md) |
| 6 | Funil e carrinhos abandonados | Concluído: eventos, atribuição e fila humana de recuperação sem envio automático. | [SPEC-018](./specs/admin-3.0/SPEC-018.md) |
| 7 | Publicação gradual | Concluído: flags no servidor, histórico, público percentual e kill switch. | [SPEC-020](./specs/admin-3.0/SPEC-020.md) |
| 8 | Operação móvel | Concluído: código de barras, voz como rascunho e reversões compensatórias. | [SPEC-021](./specs/admin-3.0/SPEC-021.md) |

### Regra de execução

Cada item entra em produção somente depois de migration aditiva, testes unitários e de integração, cenário E2E crítico, validação mobile/desktop, auditoria de permissões, feature flag e plano de reversão. As entregas 4 a 8 não devem atrasar a estabilização das três primeiras.
