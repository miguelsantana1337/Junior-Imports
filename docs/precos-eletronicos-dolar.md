# Preços dos eletrônicos vinculados ao dólar

Os 26 produtos Apple foram cadastrados como **sob encomenda**. O preço inicial é o menor valor de cada faixa aprovada pelo responsável, usando como referência a PTAX de venda de **02/09/2026: R$ 5,1273 por US$ 1**.

## Regra automática

- Fonte: serviço oficial PTAX do Banco Central do Brasil.
- Execução: dias úteis, às 15h15 no horário de Brasília.
- Fórmula: `preço-base em reais × cotação atual ÷ cotação-base`.
- Precisão: centavos, sem arredondamento comercial oculto.
- Segurança: cotações fora da faixa de R$ 1 a R$ 20 são recusadas; se o serviço não responder, o preço anterior é mantido.
- Histórico: pedidos já criados mantêm o preço registrado no pedido. Apenas o catálogo é atualizado.

## Edição no painel

Na etapa **Preço e estoque** do produto:

- **Produto sob encomenda** evita estoque fictício, reservas e alertas de reposição.
- **Atualizar preço conforme o dólar** vincula o valor ao câmbio diário.
- Ao editar manualmente o preço de um produto já vinculado, o novo valor passa a ser a referência na última cotação válida salva.

Cor, condição, prazo e disponibilidade continuam sendo confirmados com o cliente pelo WhatsApp antes da conclusão.
