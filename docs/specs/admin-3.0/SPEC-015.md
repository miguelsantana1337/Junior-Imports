# SPEC-015 — Guardião financeiro de campanhas

## 1. Contexto e problema

Cupons, descontos e cashback podem tornar uma campanha atraente para o cliente e, ao mesmo tempo, eliminar a margem do pedido. A publicação precisa mostrar o resultado financeiro antes de a oferta entrar no ar.

## 2. Objetivo

Transformar a simulação de campanhas em uma etapa obrigatória de proteção de margem, sem impedir que o Junior tome uma decisão consciente e autorizada.

## 3. Escopo

O guardião avalia campanhas de cashback, cupons, desconto por produto ou categoria, destaque promocional, indicação e kits quando alterarem preço, custo ou benefício.

## 4. Modelo de cálculo

Para cada produto, carrinho de exemplo e cenário extremo, apresentar:

- preço normal dos itens;
- desconto direto;
- desconto do cupom;
- valor final dos produtos;
- frete separado;
- base elegível de cashback;
- cashback previsto;
- custo cadastrado dos produtos;
- receita líquida operacional configurada;
- margem em reais e percentual;
- diferença em relação à margem normal.

O cashback usa o valor final pago pelos produtos, após descontos e sem frete. Campanha ativa substitui o cashback do produto. Ajuste manual de cashback no pedido substitui campanha e produto quando autorizado.

## 5. Cenários obrigatórios

- Um item elegível com menor preço.
- Um item elegível com maior cashback ou desconto.
- Carrinho médio configurável.
- Aplicação de cupom permitido junto à campanha.
- Produto sem custo cadastrado.
- Pedido com cashback manual simulado separadamente.
- Kit calculado pelos componentes e pelo preço final do kit.

## 6. Políticas de proteção

- Campanha sem custo suficiente fica como `Bloqueada para publicação` até completar os dados ou receber autorização reforçada permitida pela política.
- Margem abaixo do limite configurado exibe alerta e exige permissão específica, motivo e nova confirmação.
- Margem negativa fica bloqueada por padrão; exceção depende de papel autorizado e política explícita do tenant.
- A edição de uma campanha publicada gera nova simulação e não altera pedidos anteriores.
- A combinação entre cupom e campanha segue regra explícita; não se presume cumulatividade.
- O motor de checkout e o simulador usam a mesma função de cálculo versionada.

## 7. Fluxo de publicação

1. Definir público, período, produtos ou categorias e benefício.
2. Validar conflitos com outras campanhas e cupons.
3. Executar simulação determinística.
4. Exibir resumo “cliente paga”, “cashback”, “custo” e “margem”.
5. Corrigir, salvar rascunho ou solicitar publicação.
6. Confirmar a publicação e registrar a versão da fórmula e da simulação.

## 8. Dados e auditoria

Persistir versão da campanha, escopo, regras de combinação, fórmula, custo usado, cenários, resultados, avisos, autorização, motivo, responsável e timestamps. Pedidos guardam a versão aplicada para reprodução futura.

## 9. Experiência de uso

- Resumo principal em quatro números: valor pago, desconto, cashback e margem.
- Explicação progressiva para o Junior entender de onde saiu cada valor.
- Produtos problemáticos aparecem em uma lista acionável, não em uma tabela excessivamente larga.
- Preview responsivo e acessível em tema claro e escuro.

## 10. Critérios de aceite

- Simulador e checkout retornam os mesmos valores para a mesma entrada e versão.
- Cupom reduz a base de cashback antes do cálculo.
- Frete nunca gera cashback nem entra no custo do benefício.
- Campanha substitui cashback do produto sem somar ambos.
- Publicação abaixo da política não ocorre sem autorização reforçada.
- Pedidos antigos mantêm a regra usada na data da compra.

## 11. Testes obrigatórios

- Valores fixos e percentuais, arredondamento monetário e limites.
- Cupom aplicável e não aplicável, cumulativo e não cumulativo.
- Campanha global, por categoria, produto, segmento e período.
- Produto sem custo, margem abaixo do limite e margem negativa.
- Concorrência entre publicação, edição e início da campanha.
- E2E de rascunho, simulação, bloqueio, autorização e publicação gradual.

## 12. Decisões de configuração pendentes

- Margem mínima e perfis autorizadores.
- Carrinhos de referência para a simulação.
- Política de exceção para margem negativa.
