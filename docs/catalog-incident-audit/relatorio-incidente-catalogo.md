# Relatório de incidente — produtos ausentes na vitrine

**Data:** 15 de julho de 2026<br>
**Ambiente:** Junior Imports em produção<br>
**Status:** resolvido e validado

## Resumo executivo

Os produtos não haviam sido apagados. O painel carregava todos os registros porque o usuário administrativo possui permissão de catálogo, mas a vitrine pública recebia somente produtos com classificação regulatória concluída.

Na auditoria inicial havia 59 produtos ativos no banco: 58 estavam com `product_type = unclassified` e `regulatory_status = pending`; apenas a garrafa térmica estava classificada como item não medicamentoso e liberada. Durante a correção foi cadastrado mais um item, levando a vitrine final a 60 produtos ativos.

## Causa raiz

A migração `202607150002_catalog_publication_guardrails.sql` adicionou novos campos regulatórios com valores padrão de pendência. Os produtos já existentes foram preservados, porém ficaram automaticamente sem classificação. Ao mesmo tempo:

1. a política de leitura pública do Supabase retornava somente itens aprovados;
2. o servidor Next.js repetia o mesmo filtro antes de montar a vitrine;
3. o painel exibia apenas o status operacional `active`, criando a impressão de que todo item ativo também estava publicado.

O efeito combinado deixou 58 produtos ativos visíveis no painel e invisíveis na loja.

## Correção aplicada

- O status `active` voltou a controlar a visibilidade do catálogo.
- A política pública do Supabase agora permite a leitura de todos os produtos ativos da loja.
- A vitrine diferencia produtos disponíveis para pedido de produtos disponíveis apenas para consulta.
- Produtos pendentes aparecem com a mensagem “Consulte a disponibilidade” e levam à página individual.
- A página individual oferece consulta pelo WhatsApp e explica que o pedido aguarda validação.
- O carrinho e o banco continuam recusando itens sem validação, evitando um checkout que falharia no fim.
- O painel passou a usar o rótulo “Visível” no lugar de “Ativo”, deixando o significado do controle mais claro.
- Nenhum produto foi removido, renomeado ou reclassificado automaticamente.

## Evidências visuais

### 1. Vitrine antes da correção — atenção

Arquivo: `01-before-empty-storefront.png`

A home exibia somente a garrafa térmica, apesar de dezenas de produtos ativos no painel.

### 2. Vitrine depois da correção — saudável

Arquivo: `02-after-restored-storefront.png`

Os destaques voltaram a mostrar os produtos reais e o catálogo informa 60 produtos.

### 3. Página individual de item pendente — saudável

Arquivo: `03-product-consultation-state.png`

O produto pode ser consultado, tem informações completas em tela e apresenta um caminho claro para o WhatsApp sem liberar indevidamente o carrinho.

### 4. Vitrine no celular — saudável

Arquivo: `04-mobile-restored-storefront.png`

O catálogo apresenta os produtos e imagens reais no viewport móvel. A largura da página ficou igual à largura útil do viewport, sem rolagem horizontal.

## Validações executadas

- TypeScript: aprovado.
- Lint direcionado: aprovado.
- Testes unitários: 47 de 47 aprovados.
- Testes E2E: 22 de 22 aprovados em desktop e mobile.
- Build local de produção: aprovado.
- Build da Vercel: aprovado.
- Consulta pública do Supabase: 60 produtos ativos retornados.
- Auditoria visual ao vivo: home, página individual e celular aprovados.

## Publicação

- Migração aplicada: `202607150004_restore_catalog_visibility.sql`.
- Deploy Vercel: `dpl_DsFM1umZoqh9CLVxm481qhg88Gg8`.
- URL de produção: <https://junior-imports.vercel.app>.

## Riscos remanescentes e recomendação

Há 59 produtos ativos que continuam aguardando classificação. Eles aparecem para consulta, mas não podem ser adicionados ao carrinho. A próxima ação administrativa recomendada é revisar esses itens em lote e preencher somente classificações e dados verificáveis; o sistema não deve inventar aprovação ou registro regulatório.

Pelas capturas foi possível confirmar hierarquia visual, legibilidade geral, rotas acessíveis e ausência de overflow móvel. Navegação completa por teclado, anúncio de estados por leitor de tela e contraste medido exigem uma auditoria técnica de acessibilidade separada.
