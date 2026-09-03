# Design QA — Eletrônicos mobile

Data: 03/09/2026. Estado: implementado e validado localmente; publicação não realizada nesta entrega.

## Referência e escopo

- Referência recebida: `/Users/miguelsantana/Downloads/App Eletrônico Apple/JI Imports App.dc.html`.
- Branch de trabalho: `codex/electronics-home`, em `/Users/miguelsantana/Downloads/Junior-Imports-electronics-home`.
- Base: `8c8e880` — catálogo Apple com preços vinculados ao dólar.
- Prévia compilada: `http://127.0.0.1:3013/`.
- Foco: interface de eletrônicos até 700 px, banner rotativo e sua edição no painel compartilhado.
- O workspace original, com alterações preexistentes, não foi modificado.

## Comparação visual

O HTML original foi servido localmente e capturado. O recorte da tela do aplicativo (sem a moldura/status bar de iOS) e a implementação foram apresentados juntos em 402 × 790 px. Capturas: `source-mobile.png` e `home-402.png`.

Elementos preservados da direção visual:

- Fundo preto, superfícies grafite, acento azul e linhas discretas.
- Fontes Barlow e Barlow Condensed, títulos condensados e etiquetas compactas.
- Foto ampla no topo, preço e CTA com hierarquia clara.
- Cartões retangulares com marcações nos cantos e grade de duas colunas.
- Navegação inferior persistente e busca acessível.

Adaptações intencionais à loja real:

- Imagens, nomes, preços e condição sob encomenda vêm do catálogo, não dos exemplos do protótipo.
- A barra de anúncio existente foi mantida.
- Texto editável pode ocupar mais linhas do que a chamada curta do protótipo. Título e descrição do banner têm limite visual de três linhas no celular.
- Conta, pedidos do cliente, trade-in, comparador, estoque em três lojas e parcelamento ilustrativo não foram inventados. A navegação usa funções existentes e atendimento pelo WhatsApp configurado.
- Acrescentado carrossel configurável com até três banners; os extras começam desativados.
- O catálogo mantém busca e ordenação, com famílias de produtos reais.

## Correções feitas durante a revisão

1. **P1 corrigido:** o preço no banner de fallback precisava identificar o produto correspondente. Agora nome, preço e condição aparecem juntos; artes enviadas não recebem um preço arbitrário.
2. **P2 corrigido:** áreas de toque pequenas. Ações principais passaram a ter pelo menos 44 px.
3. **P2 corrigido:** preço e botão ultrapassavam o espaço do cartão em 320 px. Nessa largura, o botão fica em uma linha própria; a medição final do conteúdo coincide com a largura disponível.
4. **P2 corrigido:** dois controles de limpar apareciam na busca. O cancelamento nativo duplicado foi ocultado.
5. **P2 corrigido:** rotação precisava de pausa e respeito à acessibilidade. Incluídos botão de pausa, pausa durante foco/interação, aba oculta e movimento reduzido; slides inativos ficam inertes.
6. **P2 corrigido:** navegação inferior podia disputar espaço com a compra rápida do produto. A barra de compra agora fica acima da navegação, com espaço para a área segura do dispositivo.

Sem P0/P1/P2 conhecidos nas superfícies visualmente verificadas. Não equivale a uma auditoria integral de acessibilidade ou a teste em todos os aparelhos físicos.

## Testes visuais e de uso

| Tela / condição | Evidência |
| --- | --- |
| Home em 390 × 844 | `home-390-final.png`; versão compilada, sem ferramenta de desenvolvimento sobreposta |
| Comparação em 402 × 790 | `source-mobile.png` + `home-402.png` |
| Catálogo e busca em 320 × 780 | `catalog-320.png`; AirPods retorna quatro produtos, sem estouro no preço/botão |
| Carrinho em 320 × 780 | `cart-320.png`; item e total correspondem ao produto selecionado |
| Checkout em 320 × 780 | `checkout-320.png`; formulário e resumo preservados, sem envio de pedido |
| Limite mobile em 700 px | `home-700.png`; sem rolagem horizontal no documento |
| Desktop em 1440 × 1000 | `desktop-1440.png`; hero e navegação desktop preservados, carrossel/nav mobile ocultos |

Fluxos exercitados no navegador: abrir catálogo, buscar AirPods, navegar para sua categoria, abrir a ficha, adicionar um item ao carrinho, abrir checkout e esvaziar o carrinho. A busca a partir de outra página também retornou Apple Watch. Nenhum pedido foi finalizado e nenhum dado pessoal foi preenchido.

## Testes automatizados

- Suíte completa: **103 arquivos, 395 testes aprovados**.
- Após os últimos ajustes, suíte focada: **5 arquivos, 29 testes aprovados**.
- TypeScript: aprovado.
- ESLint: aprovado.
- Build de produção: aprovado.
- `git diff --check`: aprovado.

Cobertura adicionada: rotação, avanço/retorno, indicadores, pausa, foco, gesto horizontal versus rolagem vertical, movimento reduzido, desktop, aba oculta, links internos, preço do fallback, ativação/desativação e salvamento de banners no editor, agrupamento e ordenação do catálogo.

O salvamento do editor foi testado com mocks dos serviços existentes. Não foi realizada uma gravação autenticada de novos banners no Supabase de produção. Não foi necessária migração de banco.

## Isolamento e limites da verificação

- Os testes de escopo comprovam que os blocos de eletrônicos são excluídos do catálogo farmacêutico e preservam configurações financeiras e WhatsApp.
- Os estilos são limitados às classes de eletrônicos e ao breakpoint mobile. O layout farmacêutico não usa o novo wrapper nem carrega as fontes adicionadas a ele.
- Leitura do subdomínio farmacêutico atualmente publicado: HTTP 200, produtos farmacêuticos presentes, sem produto Apple, wrapper ou navegação mobile de eletrônicos.
- Uma tentativa de simular esse host em localhost chegou ao rewrite, mas o servidor local retornou redirecionamento canônico. Portanto, essa tentativa **não** é evidência de renderização local completa do subdomínio. O proxy e a configuração de domínios não foram alterados.
- A troca automática com múltiplos banners foi verificada em testes de componente. O catálogo consultado no navegador ainda possui somente o banner principal ativo.

## Próxima ação

Revisar a prévia e autorizar a publicação. Depois do deploy, conferir as duas URLs oficiais, o menu do editor e a ativação de um banner real com a conta administrativa, preservando o conteúdo atual.
