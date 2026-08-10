# SPEC-018 — Funil de conversão e recuperação de carrinhos

## 1. Contexto e problema

Como a venda continua no WhatsApp, abrir o aplicativo não significa pagamento. O painel precisa medir cada etapa e distinguir abandono real de pedido registrado, contato iniciado e venda confirmada.

## 2. Objetivo

Criar um funil confiável da navegação à entrega e uma fila humana de recuperação de carrinhos, sem envio automático de mensagens.

## 3. Etapas do funil

1. `Produto visualizado`.
2. `Adicionado ao carrinho`.
3. `Checkout iniciado`.
4. `Pedido registrado`.
5. `WhatsApp aberto`.
6. `Pagamento parcial` quando houver.
7. `Pagamento integral confirmado`.
8. `Pedido entregue`.

Eventos técnicos repetidos não avançam a pessoa duas vezes. `WhatsApp aberto` é intenção de contato, não confirmação de envio, leitura ou pagamento.

## 4. Atribuição

- Sessão, canal, origem, campanha, cupom, produto, categoria e kit quando disponíveis.
- Primeira e última origem preservadas para análise.
- Pedido guarda a campanha e a regra comercial efetivamente aplicadas.
- Identificação do cliente ocorre apenas quando ele fornece ou autentica os dados necessários.
- Eventos anônimos e identificados são conciliados sem duplicar o funil.

## 5. Definição de carrinho abandonado

- Carrinho possui item e atividade de checkout, mas não gerou pedido no prazo configurado; ou
- Pedido foi registrado, mas não recebeu contato/pagamento dentro da janela operacional configurada.

As duas situações aparecem separadas. Carrinhos convertidos, vazios, expirados por retenção ou ligados a pedido cancelado não permanecem como oportunidade ativa.

## 6. Fila de recuperação

- Priorizar por valor, recência, cliente identificado e histórico de relacionamento.
- Exibir itens, total, cupom, origem, última etapa e motivo provável.
- Ações: abrir carrinho, abrir cliente, preparar mensagem, marcar contato, adiar, concluir ou descartar com motivo.
- O sistema prepara texto e link `wa.me`; o Junior revisa e envia manualmente.
- Frequência de contato e período de silêncio são configuráveis para evitar insistência.
- O plugin do ChatGPT pode localizar oportunidades e preparar mensagens, nunca enviá-las automaticamente.

## 7. Privacidade e retenção

- Registrar apenas dados necessários ao funcionamento e à análise do funil.
- Exibir aviso de privacidade e política de retenção de forma acessível.
- Não criar perfil identificado antes de o cliente fornecer dados.
- Permitir anonimização ou exclusão conforme política e obrigações legais.
- Nenhum evento contém segredos, termos de autenticação ou conteúdo completo de mensagem privada.

## 8. Métricas

- Conversão entre cada etapa.
- Tempo médio entre checkout, WhatsApp e pagamento.
- Receita confirmada, não apenas valor de carrinho.
- Recuperação por operador, campanha e origem.
- Cupons usados, desconto, cashback e margem associados à conversão.
- Quedas anormais comparadas à linha de base operacional.

## 9. Critérios de aceite

- Cada sessão avança uma vez por etapa e mantém a ordem possível dos eventos.
- Abrir WhatsApp não conta como pagamento nem como mensagem enviada.
- Carrinho convertido sai da fila automaticamente.
- Mensagem de recuperação é apenas preparada e depende de ação humana.
- Atribuição do pedido pode ser reproduzida pela versão dos eventos e regras.
- Dados de um tenant nunca aparecem em outro.
- Métricas financeiras usam pedidos pagos, respeitando pagamentos parciais.

## 10. Testes obrigatórios

- Jornada anônima, identificada e conciliada.
- Recarregamento, múltiplas abas e eventos duplicados.
- Carrinho sem pedido, pedido sem pagamento e conversão tardia.
- Cupom, campanha, cashback, kit e indicação.
- Retenção, anonimização, isolamento por tenant e permissões.
- Fila e preparação de WhatsApp em desktop/mobile.
- E2E produto → carrinho → checkout → pedido → WhatsApp → pagamento → entrega.

## 11. Fora de escopo

- Afirmar que uma mensagem foi entregue ou lida sem integração oficial que forneça essa evidência.
- Disparo automático de WhatsApp.
- Compra de mídia ou automação de anúncios.
