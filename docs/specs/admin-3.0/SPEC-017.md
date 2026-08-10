# SPEC-017 — Kits e produtos configuráveis

## 1. Contexto e problema

O kit degustação é vendido como um produto, mas seu estoque real é composto por quatro ampolas escolhidas pelo cliente. O sistema precisa registrar a composição exata, evitar venda sem estoque e baixar cada componente corretamente.

## 2. Objetivo

Criar um motor reutilizável de kits configuráveis, começando pelo kit degustação de quatro ampolas de 15 mg.

## 3. Configuração do kit

- Nome, descrição, imagens, preço, custo complementar e visibilidade.
- Quantidade mínima e máxima de componentes; o kit inicial exige exatamente quatro.
- Grupos de escolha com produtos ou variantes elegíveis.
- Regra de repetição: permitida, limitada ou proibida.
- Quantidade máxima por componente.
- Período de venda, limite por pedido e disponibilidade.
- Cashback, cupom e categorias seguem as regras gerais da loja.

Os valores iniciais de elegibilidade e repetição dependem de aprovação do Junior; não são inferidos pelo sistema.

## 4. Experiência do cliente

1. Cliente abre o kit e vê “Escolha 4 ampolas”.
2. Cada opção mostra nome, imagem e disponibilidade, sem expor SKU interno na mensagem de WhatsApp.
3. Contador informa quantas escolhas faltam e impede quantidade inválida.
4. Opções esgotadas ficam indisponíveis imediatamente.
5. Carrinho e checkout exibem o kit e a composição completa.
6. Mensagem preparada para WhatsApp lista as quatro escolhas em texto simples, compatível com Android e iOS.

## 5. Estoque e transações

- O kit não possui estoque físico independente; sua disponibilidade deriva dos componentes elegíveis.
- Ao criar o pedido, o sistema valida e reserva cada componente em uma única transação.
- Pagamento integral efetiva a baixa conforme a rotina vigente do pedido.
- Cancelamento libera ou devolve cada componente de acordo com o estágio da venda.
- Repetição, retry ou concorrência não pode reservar ou baixar o mesmo componente duas vezes.
- Alterar a composição de um pedido existente exige prévia do impacto, motivo, confirmação e auditoria.
- Ajustes manuais de estoque usam os produtos componentes, não o SKU virtual do kit.

## 6. Pedido manual e administração

- O criador de pedido manual usa o mesmo seletor do cliente e busca incremental.
- O editor do kit possui preview, validação de regras e simulação de disponibilidade.
- A lista de pedidos permite filtrar kits e visualizar a composição sem abrir cada item.
- Relatórios separam receita do kit e consumo/custo por componente.

## 7. Modelo conceitual

- `product_bundles`: produto vendido, regras, versão e estado.
- `bundle_groups`: quantidade exigida e regra de repetição.
- `bundle_options`: produto/variante elegível e limites.
- `order_item_components`: item do pedido, componente escolhido, quantidade, preço/custo de referência e movimentos relacionados.

Pedidos preservam a versão e a composição da compra mesmo que o kit seja alterado depois.

## 8. Critérios de aceite

- Cliente só adiciona o kit com a quantidade exata configurada.
- Estoque indisponível bloqueia a escolha antes da confirmação.
- Duas compras concorrentes não geram estoque negativo.
- Reserva, baixa, cancelamento e devolução afetam todos os componentes uma única vez.
- Carrinho, pedido, painel e WhatsApp mostram a mesma composição.
- Cupom e cashback usam o preço final do kit, enquanto o guardião usa o custo dos componentes.
- Alterar o kit publicado não muda pedidos anteriores.

## 9. Testes obrigatórios

- Quatro itens diferentes e repetidos conforme configuração.
- Item esgotado durante a escolha e na confirmação.
- Concorrência pelo último componente.
- Pedido manual, checkout, pagamento, cancelamento e estorno.
- Compatibilidade com cupom, cashback, campanha e ajuste manual.
- Mensagem sem SKU e sem caracteres dependentes de um único sistema operacional.
- Responsividade em celular pequeno, tablet e desktop.

## 10. Fora de escopo inicial

- Cálculo de frete por peso ou embalagem do kit.
- Substituição automática de componente esgotado.
- Montagem física ou logística automatizada.
