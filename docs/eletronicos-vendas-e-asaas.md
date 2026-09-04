# Eletrônicos: venda, Google e Asaas

## Estado desta entrega

Base: origin/main, fc4d7b6. Loja oficial: https://www.juniorimportsoficial.com.br/.
O checkout antigo em Downloads/Junior-Imports-main foi preservado. A entrega de produção está no worktree Junior-Imports-electronics-sales.

Implementados sobre o layout publicado: entrega e retirada com tarifas reais, oito perguntas frequentes, quatro páginas de políticas, links no rodapé, termos próprios no checkout, separação da promoção farmacêutica e inclusão das políticas no sitemap/indexação seletiva. O schema de produtos sob encomenda não inventa disponibilidade datada.

## Decisão de pagamento

O usuário escolheu checkout personalizado com gateway Asaas. A conta ainda será criada. O adaptador server-only está em src/lib/asaas-client.ts, com sandbox/produção explícitos, produção bloqueada por padrão, timeout de 65 segundos e sem repetição automática de POST. Há funções para cliente, cobrança, consulta e Pix. Os helpers de validação de webhook e estado não constituem um endpoint ativo.

O pagamento Asaas ainda NÃO está conectado ao checkout, ao banco ou ao painel financeiro. Não há cobrança de teste ou real, endpoint de webhook publicado, nem processamento de cartão nesta entrega. O fluxo existente por WhatsApp continua ativo. Não anunciar pagamento online ativo antes de concluir as etapas abaixo.

## Ativação após criação da conta

1. Criar/verificar a conta comercial da Junior Imports no Asaas e a conta de sandbox; confirmar habilitação de Pix e cartão. Configurar segredos privados ASAAS_API_KEY, ASAAS_ENVIRONMENT=sandbox e ASAAS_WEBHOOK_TOKEN (aleatório, pelo menos 32 caracteres) no ambiente de testes. Não usar prefixo NEXT_PUBLIC em segredos.
2. Implementar sessão de pagamento vinculada a pedido persistido com autorização por token opaco, expiração, valor calculado no servidor e tentativa única com bloqueio no banco. Nunca confiar em valor ou status enviados pelo navegador. Recusar cobrança com frete pendente ou disponibilidade não confirmada.
3. Registrar customer/payment IDs do Asaas com isolamento por tenant, RLS e chave única por tentativa. Em timeout inconclusivo, reconciliar a cobrança existente antes de criar outra. externalReference não garante idempotência.
4. Finalizar o checkout visual com CPF/CNPJ, Pix copia e cola/QR Code, cartão e resultado pendente/aprovado/recusado. Não persistir/logar PAN ou CVV. O pagamento direto de cartão usa HTTPS, creditCard e creditCardHolderInfo ou token habilitado para a conta.
5. Implementar webhook autenticado pelo header asaas-access-token, deduplicação por event.id e reconciliação pela API. Validar customer, externalReference, moeda/valor e pedido antes de alterar financeiro. Aplicar pagamento, cashback e estoque na mesma transação; tratar atraso, estorno, chargeback e repetição de eventos.
6. Validar sandbox ponta a ponta: Pix aprovado, cartão aprovado/recusado, timeout, reenvio de webhook, pedido cancelado/expirado e reembolso. Só após esses testes configurar produção com ASAAS_ENVIRONMENT=production e ASAAS_PRODUCTION_ENABLED=true.

## Google Merchant Center

A página indexável e o sitemap não garantem aprovação no Merchant. Ainda são necessários: checkout direto ativo; conta Merchant com domínio verificado; identificação comercial/endereço; condição, GTIN/MPN reais de cada variação; estoque ou availability_date verdadeiro; frete/prazo e devolução configurados. Os produtos atuais sob encomenda sem prazo não devem ser exportados como in_stock nem como out_of_stock por conveniência. O feed definitivo deve derivar dos registros comerciais validados e ter valores iguais aos do checkout.

## Referências oficiais consultadas

- https://docs.asaas.com/docs/cobrancas-via-cartao-de-credito
- https://docs.asaas.com/reference/pagar-uma-cobranca-com-cartao-de-credito
- https://docs.asaas.com/reference/obter-qr-code-para-pagamentos-via-pix
- https://docs.asaas.com/docs/sobre-os-webhooks
- https://support.google.com/merchants/answer/9158778
- https://support.google.com/merchants/answer/6324448
