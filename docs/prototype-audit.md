# Auditoria do protótipo Junior Imports V3

Auditoria realizada em 13/07/2026 antes do início da migração.

## Inventario

- `index.html`: estrutura integral da vitrine, modais e painel.
- `styles.css`: identidade visual, responsividade e painel em CSS global minificado.
- `script.js`: dados-semente, estado, renderização, carrinho, checkout e CRUD administrativo.
- `README.md`: recursos e instruções do protótipo.
- `netlify.toml`: cabeçalhos de segurança.
- `assets/favicon.svg`: símbolo JI.

## Funcionalidades preservadas

Carrossel, catálogo, busca, filtros, ordenação, favoritos, carrinho, cupons,
checkout demonstrativo, pedidos, WhatsApp, dashboard, produtos, banners,
categorias, seções, cupons, pedidos, configurações, exportação, importação e
restauração de dados.

## Riscos encontrados

1. Dados, imagens e PIN administrativo persistidos apenas em `localStorage`.
2. Ausência de páginas de produto, testes, validação de domínio e autorização.
3. Carrinho vazio exibe frete e total de R$ 29,90.
4. O seletor `.admin-login { display: grid }` sobrescreve o atributo `hidden`;
   depois do PIN correto, a tela de login continua cobrindo o painel.
5. Regras de preço, desconto, frete e pedido rodam integralmente no cliente.

O prototipo original permanece intacto em
`C:\Users\migue\Downloads\junior-imports-v3-corrigida\junior-imports-v3`.
