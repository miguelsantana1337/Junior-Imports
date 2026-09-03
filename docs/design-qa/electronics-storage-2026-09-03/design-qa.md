# QA — armazenamento como variação

Data: 03/09/2026. Entrega local, na branch `codex/electronics-home`, sobre `6d580f2`. Sem deploy ou alteração do banco nesta entrega.

## Resultado

Os 26 cadastros Apple resultam em 22 cartões. iPhone 17 Pro (256/512 GB), iPhone 17 Pro Max (256/512 GB/1 TB) e iPad 11 A16 (128/256 GB) aparecem como modelos com escolha de armazenamento. Modelos, gerações, telas e RAM distintos permanecem separados.

A implementação é uma camada de apresentação sobre os SKUs existentes, não uma migração para uma nova entidade de produto-pai. O administrador continua editando cada capacidade em Produtos. Nenhum preço, estoque, regra de dólar, campanha, ID ou pedido histórico foi modificado.

## Verificações

- **105 arquivos / 409 testes aprovados**, incluindo 14 testes novos de agrupamento e compra por capacidade.
- **TypeScript, ESLint, build de produção e `git diff --check`: aprovados.**
- Busca por modelo e capacidade, menor/maior preço, ordem da loja, itens inativos, opções esgotadas, marcas/categorias diferentes e capacidades duplicadas cobertos nos testes.
- Seleção mantém o slug original. Teste de componente comprova ID e quantidade enviados ao carrinho, reinício da quantidade ao trocar de SKU e respeito ao estoque individual.
- O teste de escopo mantém a ficha fora da vitrine de eletrônicos sem o seletor. A apresentação farmacêutica não foi redesenhada.

## Navegador

1. Busca por `iPhone 17 Pro` mostra dois modelos, Pro e Pro Max, sem cartões por capacidade.
2. Troca de 256 GB para 512 GB no Pro atualiza URL, marca de seleção, nome completo da versão na descrição e preço de R$ 7.800,00 para R$ 9.350,00.
3. Carrinho exibiu **iPhone 17 Pro 512GB**, uma unidade e R$ 9.350,00. O item de teste foi removido; nenhum pedido foi finalizado nem dado pessoal preenchido.
4. Pro Max de 1 TB exibiu R$ 12.000,00 e as três opções. Testado na prévia recompilada em `http://127.0.0.1:3013/`.
5. Em 320 px, as opções têm 116 px de largura útil, sem conteúdo transbordando, e 93 px de altura. Em 390 e 1440 px, o documento também não apresentou rolagem horizontal.

Valores acima são evidências do catálogo consultado durante o teste; continuam sujeitos à atualização normal dos preços da loja.

## Capturas

- `catalog-390.png`: cartões agrupados na prévia compilada.
- `storage-320.png`: três capacidades, opção de 1 TB selecionada, em celular estreito.
- `storage-1440.png`: mesma seleção no computador.

## Limites

- Agrupamento automático pelo nome: reconhece iPhone, iPad e MacBook não medicamentosos, com armazenamento no fim do nome, mesma marca e categoria. Nomes ambíguos com capacidade repetida permanecem separados.
- Variações por cor/condição e um editor administrativo de produto-pai não foram criados.
- As capturas e testes são locais, não prova de deploy nem teste em aparelhos físicos. Não houve gravação administrativa de produtos nem criação de pedido real.

Guia de uso atualizado em `docs/eletronicos-mobile-banners.md`.
