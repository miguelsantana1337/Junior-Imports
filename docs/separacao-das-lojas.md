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

## Classificação dos produtos

A categoria `eletronicos` (ou o nome legado `Eletrônicos`) identifica o catálogo principal. Os demais produtos permanecem no catálogo original. Novos eletrônicos precisam ser cadastrados nessa categoria.

Esta mudança não importa a lista de produtos Apple enviada separadamente, não define preços de faixas e não altera estoques. O catálogo atual contém apenas o eletrônico já cadastrado; novos cadastros dependem da confirmação dos preços e disponibilidades.

## Conteúdo e carrinho

O conteúdo do editor visual existente (banners, páginas e blocos) continua no catálogo original. A nova home de eletrônicos tem apresentação própria e guia de compra; ela não publica automaticamente esses blocos institucionais.

Dados de produtos são filtrados no servidor antes de serem enviados ao navegador, além da filtragem do lado do cliente. Favoritos, carrinho e sessão de acompanhamento têm namespaces diferentes. Carrinhos antigos do endereço principal não são migrados automaticamente para o subdomínio; pedidos já registrados no banco permanecem intactos.

Regras financeiras compartilhadas não são reconfiguradas por esta mudança. Campanhas específicas de produtos fora do catálogo não são convertidas em campanhas globais. O cálculo do carrinho eletrônico foi comparado antes e depois da filtragem.

## Limite da separação

São vitrines separadas, não bancos de dados separados nem um novo sistema de acesso por senha. `noindex, nofollow` permanece configurado, mas não garante sigilo nem impede que alguém com o endereço acesse o catálogo. A administração e as APIs mantêm suas proteções existentes. Controle de acesso ao catálogo exige um projeto adicional de autenticação/autorização.

## Endereços de produção e DNS

- Eletrônicos: `https://juniorimportsoficial.com.br` (também no alias `https://junior-imports.vercel.app`).
- Catálogo original: `https://farmaceuticos.juniorimportsoficial.com.br`.

Na retomada para publicação, a verificação autenticada da Vercel confirmou o subdomínio como `configured-correctly`, vinculado ao projeto `junior-imports`. O acesso direto por HTTPS retornou 200.

Os nameservers observados passaram a ser `ns1.vercel-dns.com` e `ns2.vercel-dns.com`. Essa alteração já estava aplicada ao retomar a tarefa; não foi necessário alterar DNS ou e-mail nesta publicação. A recomendação anterior de CNAME no Registro.br deixou de ser uma pendência.

O hostname padrão está em `src/lib/pharmaceutical-storefront-host.ts`. Para outro endereço, configure `PHARMACEUTICAL_STOREFRONT_HOST` na Vercel e refaça o deploy.

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

- Suite automatizada: 357 testes em 94 arquivos, incluindo escopos, campanhas, armazenamento, roteamento por host, proteção contra cabeçalho de escopo forjado, rotas administrativas e integração MCP.
- TypeScript, ESLint e build de produção.
- Servidor de produção local: `localhost:3020` para eletrônicos e `127.0.0.1:3020` para catálogo original, usando `PHARMACEUTICAL_STOREFRONT_HOST=127.0.0.1`.
- HTML da home eletrônica sem produtos/categorias farmacêuticos e HTML da outra home sem iPhone.
- Links diretos de produtos: 200 no catálogo correto e 404 no outro.
- Busca por produto farmacêutico na home eletrônica: nenhum resultado.
- Inclusão de eletrônico no carrinho e navegação ao checkout, sem finalizar pedido nem movimentar estoque.
- Carrinho vazio no outro host; nenhum link para a loja eletrônica na navegação observada do catálogo original.
- Desktop a 1280 px e celular a 390 px, sem overflow horizontal nas duas homes; menu móvel e guia de compra funcionais.

O fluxo final de registro de pedido não foi executado contra dados reais. Após a publicação, confirmar novamente os dois domínios reais; preview/build isoladamente não são prova de funcionamento em produção.
