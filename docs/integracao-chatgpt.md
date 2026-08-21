# Junior Imports no ChatGPT

## Visão geral

A integração transforma o ChatGPT em uma interface conversacional privada para a rotina da Junior Imports. Ela não substitui o painel: usa as mesmas permissões, regras de negócio e trilha de auditoria.

O canal técnico é um servidor MCP hospedado junto da aplicação em `https://junior-imports.vercel.app/mcp`. O acesso é feito por OAuth 2.1 com PKCE, exige login administrativo e MFA e pode ser revogado em **Administração → ChatGPT**.

O plugin privado atualmente cadastrado no ChatGPT usa o ID `plugin_asdk_app_6a791aabfe5081918c1990d6a492880d`. No Codex, o pacote pessoal correspondente se chama `junior-imports@personal`.

## O que o ChatGPT pode consultar

- prioridades do dia, pedidos novos e pagamentos pendentes;
- pedidos por período, situação operacional e situação de pagamento;
- posição do estoque, itens baixos ou zerados, total de unidades e valor armazenado;
- faturamento, pagamentos recebidos, ticket médio, lucro bruto e margem;
- entradas, saídas, despesas e resultado de caixa;
- produtos e clientes individuais;
- oportunidades de recompra;
- mensagens de WhatsApp preparadas para revisão humana.

As consultas por período usam, por padrão, o mês atual até hoje e respeitam a data de início da operação oficial configurada no painel. O resumo financeiro separa **faturamento de pedidos recebidos** de **dinheiro efetivamente recebido no período**, evitando apresentar venda e caixa como se fossem o mesmo número.

## O que pode alterar

- avançar a próxima etapa segura de um pedido;
- registrar pagamento integral ou parcial;
- cancelar um pedido;
- arquivar ou restaurar um pedido;
- ajustar o valor financeiro de um pedido sem alterar o checkout original;
- registrar entrada ou saída de caixa;
- registrar movimentação de estoque.

Toda alteração segue duas etapas:

1. o ChatGPT prepara a ação e mostra o resumo exato do impacto;
2. somente após a confirmação explícita do usuário ele utiliza um código temporário, válido por cinco minutos e uma única vez.

## Regras de segurança

- o ChatGPT nunca recebe a senha nem o código do aplicativo autenticador;
- os tokens OAuth são opacos e ficam armazenados somente como SHA-256;
- tabelas e funções da integração não são acessíveis aos papéis públicos do Supabase;
- cada ferramenta verifica o usuário, a loja, o escopo e a permissão administrativa;
- os limites são de 60 consultas ou 20 tentativas de alteração por minuto e usuário;
- confirmações ficam vinculadas ao usuário, à loja, à ferramenta e ao conteúdo exato da ação;
- o histórico técnico grava hashes e metadados mínimos, sem copiar o conteúdo consultado;
- mensagens de WhatsApp são apenas preparadas: o envio continua sendo humano;
- a conexão pode ser removida pelo próprio usuário em **Administração → ChatGPT**.

## Como conectar

1. Abra o ChatGPT e escolha o plugin **Junior Imports**.
2. Clique em **Conectar** quando solicitado.
3. Entre no painel administrativo da Junior Imports.
4. Confirme o código do aplicativo autenticador.
5. Revise os acessos e clique em **Autorizar com MFA**.
6. Volte ao ChatGPT e peça, por exemplo: “Mostre as prioridades de hoje”.

Cada administrador deve conectar a própria conta. O plugin respeitará o perfil de acesso individual.
Na primeira autorização, confirme que o consentimento mostra **Consultar a operação** e **Preparar alterações**. Se apenas a consulta aparecer, use **Ações do plugin → Reconectar** para conceder também `junior.write`.

## Exemplos de uso

- “Quais pedidos precisam de atenção hoje?”
- “Quantos pedidos tivemos neste mês e qual foi o faturamento?”
- “Liste os pedidos com pagamento parcial deste mês.”
- “Consulte o pedido JI-1052.”
- “Quanto ainda falta pagar no pedido do Thayrone?”
- “Quanto entrou de pagamentos e quanto saiu de despesas nos últimos 30 dias?”
- “Qual foi o ticket médio e a margem bruta deste mês?”
- “Prepare uma mensagem de cobrança para o pedido JI-1052.”
- “Registre R$ 500,00 de pagamento parcial via Pix no pedido JI-1052.”
- “Quais produtos estão com estoque baixo?”
- “Qual é o valor atual do estoque a custo e quantos produtos estão zerados?”
- “Registre uma perda de uma unidade do produto JI-070.”
- “Mostre oportunidades de recompra com mais de 35 dias.”

## Como desconectar

No painel, abra **Administração → ChatGPT** e clique em **Desconectar ChatGPT**. Todas as sessões OAuth ativas daquele usuário são revogadas imediatamente. Para usar novamente, será necessário repetir login, MFA e autorização.

## Operação técnica

### Endpoints

- MCP: `/mcp`
- metadados do recurso: `/.well-known/oauth-protected-resource`
- metadados do servidor de autorização: `/.well-known/oauth-authorization-server`
- autorização: `/api/mcp/oauth/authorize`
- token: `/api/mcp/oauth/token`
- registro dinâmico: `/api/mcp/oauth/register`
- revogação: `/api/mcp/oauth/revoke`

### Validação de uma publicação

1. confirmar que a migration `202608090003_chatgpt_mcp_plugin.sql` consta no histórico remoto;
2. executar `pnpm typecheck`, `pnpm lint`, `pnpm test:run` e `pnpm build`;
3. verificar os dois documentos `/.well-known/` no domínio de produção;
4. chamar `/mcp` sem token e confirmar resposta `401` com `WWW-Authenticate`;
5. conectar uma conta com MFA;
6. testar uma consulta;
7. preparar uma escrita e confirmar que nada muda antes da aprovação explícita;
8. concluir uma escrita controlada e conferir a auditoria;
9. revogar a conexão e confirmar que o token anterior deixa de funcionar.

Em 09/08/2026, o fluxo real foi validado no ChatGPT com os escopos `junior.read` e `junior.write`. A consulta **“visão operacional de hoje”** chamou a ferramenta do plugin e retornou dados do painel sem produzir nenhuma alteração.

## Recuperação

Se houver comportamento inesperado, use **Administração → ChatGPT → Desconectar ChatGPT**. Essa ação interrompe o acesso sem afetar pedidos, clientes, estoque ou financeiro. A integração pode ser reconectada depois.
