# Separação das lojas — eletrônicos e catálogo original

Atualização de 02/09/2026. Desenvolvimento em `codex/electronics-home`; publicação pela branch `main`.

## Estrutura da atualização

- O endereço principal passa a abrir a home de eletrônicos.
- O catálogo original fica em `farmaceuticos.juniorimportsoficial.com.br`.
- Menus, busca, rodapé, recomendações e carrinho da home principal não misturam os catálogos.
- Links de produtos do catálogo original no domínio principal retornam 404. Não há redirecionamento público que revele o outro endereço.
- `/eletronicos` redireciona para `/`, preservando busca e código de indicação.
- O painel continua único. Não são duplicados ou removidos produtos, clientes, pedidos, estoque, caixa ou cashback.
- O WhatsApp continua vindo das configurações existentes da loja.
- O Editor da loja tem duas opções: Eletrônicos e Farmacêuticos. Cada uma abre a prévia do catálogo correspondente. No programa de indicações, o administrador também escolhe qual vitrine o link deve abrir, sem alterar código ou recompensa.
- Botões editoriais antigos apontando para os domínios principais conhecidos passam a usar o mesmo catálogo em que são exibidos. Links externos, como WhatsApp, permanecem iguais; os registros originais no banco não são alterados.

## Classificação dos produtos

A categoria `eletronicos` (ou o nome legado `Eletrônicos`) identifica o catálogo principal. Os demais produtos permanecem no catálogo original. Novos eletrônicos precisam ser cadastrados nessa categoria.

Esta mudança não define preços de faixas nem altera estoques. A conferência autenticada do painel em 02/09/2026 encontrou a categoria Eletrônicos sem produtos cadastrados (incluindo ocultos). Os 26 itens Apple foram preparados em `docs/catalogo-apple-preparado.json`, com nomes, descrições, valores de referência fornecidos pelo usuário e imagens de fontes oficiais. As 19 URLs de imagem distintas estavam acessíveis na verificação. **Esse arquivo não é uma importação realizada**: preço final, estoque e custo permanecem nulos, sem valores inventados. Publicar os cadastros depende da confirmação dos preços e da disponibilidade. Algumas variantes, especialmente a geração do AirTag e a conexão do estojo dos AirPods Pro 2, também precisam de confirmação antes de usar a imagem correspondente.

## Conteúdo e carrinho

O conteúdo do editor visual original (banners, páginas e blocos) continua no catálogo farmacêutico. A home de eletrônicos tem conteúdo próprio, editável no mesmo painel. Não publica automaticamente os blocos institucionais do outro catálogo.

### Como o Junior edita os eletrônicos

1. Acessar o painel pelo login habitual, mantendo a verificação em duas etapas.
2. Abrir **Produtos → Eletrônicos**. É possível buscar, editar fotos, descrição, preço, estoque, visibilidade e destaque com as mesmas ferramentas existentes.
3. Usar **Adicionar produto** nessa visão: a categoria Eletrônicos e o tipo não medicamentoso já vêm selecionados. Confirmar todos os dados reais antes de publicar.
4. Abrir **Editor da loja → Eletrônicos** para alterar o banner principal, a barra de anúncio, os textos do catálogo, as colunas no computador, o guia de compra e a descrição do rodapé.
5. Salvar cada seção alterada. As mensagens de erro preservam o texto para permitir nova tentativa; nada muda na outra home.
6. Usar **Ver eletrônicos** para conferir o resultado. Sem imagem de banner personalizada, o primeiro eletrônico em destaque é usado; se não houver destaque, aparece o primeiro produto da ordem do catálogo.

Os destaques e a visibilidade de categorias alterados no editor farmacêutico ficam limitados a esse catálogo, preservando as escolhas dos eletrônicos. Pedidos, clientes, financeiro e configurações de WhatsApp continuam compartilhados. A imagem personalizada do banner é opcional; a indicação é 1200 × 1200 px.

O conteúdo eletrônico reutiliza as tabelas existentes `store_pages` e `page_blocks`, com identificadores próprios por tenant. A página reservada não aparece no menu público nem no editor de páginas farmacêuticas. Não há migração de banco nem novos acessos administrativos nesta atualização.

Dados de produtos são filtrados no servidor antes de serem enviados ao navegador, além da filtragem do lado do cliente. Favoritos, carrinho e sessão de acompanhamento têm namespaces diferentes. Carrinhos antigos do endereço principal não são migrados automaticamente para o subdomínio; pedidos já registrados no banco permanecem intactos.

Regras financeiras compartilhadas não são reconfiguradas por esta mudança. Campanhas específicas de produtos fora do catálogo não são convertidas em campanhas globais. O cálculo do carrinho eletrônico foi comparado antes e depois da filtragem.

## Limite da separação

São vitrines separadas, não bancos de dados separados nem um novo sistema de acesso por senha. `noindex, nofollow` permanece configurado, mas não garante sigilo nem impede que alguém com o endereço acesse o catálogo. A administração e as APIs mantêm suas proteções existentes. Controle de acesso ao catálogo exige um projeto adicional de autenticação/autorização.

## Endereços de produção e DNS

- Eletrônicos: `https://juniorimportsoficial.com.br`, com redirecionamento já existente para `https://www.juniorimportsoficial.com.br` (também no alias `https://junior-imports.vercel.app`).
- Catálogo original: `https://farmaceuticos.juniorimportsoficial.com.br`.

Na retomada para publicação, a verificação autenticada da Vercel confirmou o subdomínio como `configured-correctly`, vinculado ao projeto `junior-imports`. O acesso direto por HTTPS retornou 200.

Os nameservers observados passaram a ser `ns1.vercel-dns.com` e `ns2.vercel-dns.com`. Essa alteração já estava aplicada ao retomar a tarefa; não foi necessário alterar DNS ou e-mail nesta publicação. A recomendação anterior de CNAME no Registro.br deixou de ser uma pendência.

O hostname padrão está em `src/lib/pharmaceutical-storefront-host.ts`. Para mudar os endereços no futuro, alinhar os hosts do roteamento e os atalhos administrativos em `src/lib/admin-catalog-link.ts`; o roteamento também aceita `PHARMACEUTICAL_STOREFRONT_HOST` na Vercel. Refazer o deploy e conferir os links gerados.

### Ordem segura de publicação

1. Confirmar resolução pública dos dois endereços.
2. Rodar `vercel domains verify farmaceuticos.juniorimportsoficial.com.br`; exigir configuração válida e HTTPS funcional antes da troca.
3. Publicar a branch validada em `main` e aguardar o deploy ficar Ready.
4. Conferir `/`, produto eletrônico, carrinho e checkout no endereço principal.
5. Conferir home original, produto original e checkout no subdomínio.
6. Conferir ausência de links cruzados e os 404 de produtos fora do catálogo.
7. Validar login/MFA no endereço administrativo já utilizado, sem migrar sessões administrativas para o novo host.

O bloqueio anterior por DNS foi resolvido. A versão anterior à separação é `3464cf9`; mantê-la como referência de recuperação, sem apagar os commits da atualização.

## Validação realizada

- Suite automatizada: 362 testes em 95 arquivos, incluindo escopos, campanhas, armazenamento, roteamento por host, proteção contra cabeçalho de escopo forjado, rotas administrativas, atalhos do editor, destino das indicações, links editoriais e integração MCP.
- TypeScript, ESLint e build de produção.
- Servidor de produção local: `localhost:3020` para eletrônicos e `127.0.0.1:3020` para catálogo original, usando `PHARMACEUTICAL_STOREFRONT_HOST=127.0.0.1`.
- HTML da home eletrônica sem produtos/categorias farmacêuticos e HTML da outra home sem iPhone.
- Links diretos de produtos: 200 no catálogo correto e 404 no outro.
- Busca por produto farmacêutico na home eletrônica: nenhum resultado.
- Durante a preparação, inclusão do eletrônico então publicado no carrinho e navegação ao checkout, sem finalizar pedido nem movimentar estoque. Esse cenário não pôde ser repetido com o catálogo público atual, que está sem eletrônicos publicados.
- Carrinho vazio no outro host; nenhum link para a loja eletrônica na navegação observada do catálogo original.
- Desktop a 1280 px e celular a 390 px, sem overflow horizontal nas duas homes; menu móvel e guia de compra funcionais.

- Produção: as duas homes respondem em HTTPS e a API de acompanhamento aceita a origem correta de cada loja. O domínio sem `www` redireciona para `www`; uma chamada artificial que preserve o Origin antigo após seguir esse redirecionamento é recusada corretamente pela proteção de origem. Não foi necessário relaxar essa proteção.

O fluxo final de registro de pedido não foi executado contra dados reais, nem foi simulado pagamento, envio ou movimentação financeira. Login/MFA continua protegido; não foi feita uma operação administrativa autenticada em produção durante esta validação. A estrutura foi publicada, mas a venda de eletrônicos depende da publicação de produtos com valores e disponibilidade confirmados.

### Complemento: edição compartilhada

Além dos testes anteriores, foram adicionados cenários para persistência isolada da home eletrônica, valores opcionais vazios, falha de gravação com preservação do formulário, destinos internos seguros, filtros salvos por catálogo e seleções em lote sem afetar a outra vitrine. A validação comercial do catálogo e uma compra eletrônica completa continuam pendentes dos preços e da disponibilidade reais.

Validação local desta etapa: **376 testes em 99 arquivos**, TypeScript, ESLint e build de produção aprovados. A configuração de colunas é aplicada ao carrossel eletrônico no computador e mantém os ajustes responsivos existentes para telas menores.
