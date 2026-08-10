# SPEC-016 — Programa de indicação e cashback

## 1. Contexto e problema

Clientes que indicam novos compradores devem receber um benefício maior, mas o prêmio só pode existir quando a indicação é legítima e gera uma primeira compra integralmente paga.

## 2. Objetivo

Criar um programa rastreável de indicação, com regras antifraude, recompensa reversível, limites e possibilidade de bônus manual pelo Junior.

## 3. Papéis

- `Indicador`: cliente existente que compartilha o código ou link.
- `Indicado`: pessoa nova vinculada ao código antes da primeira compra elegível.
- `Administrador`: configura a campanha, analisa bloqueios e concede bônus manual.

## 4. Regras de elegibilidade

- Cada indicador possui código e link únicos, não sequenciais e revogáveis.
- A indicação precisa ser registrada antes da primeira compra elegível.
- O indicado deve ser um cliente novo segundo identificadores normalizados e sinais de duplicidade definidos pelo sistema.
- Autoindicação e vínculo circular são bloqueados.
- A recompensa nasce como `Prevista` e só fica `Disponível` após o primeiro pedido integralmente pago.
- Pagamento parcial não libera recompensa.
- Cancelamento, estorno ou invalidação da compra reverte a recompensa correspondente.
- Um indicado gera o benefício de primeira compra uma única vez.
- Tetos por período, valor e quantidade são configuráveis por campanha.

## 5. Cálculo e relação com outros cashbacks

- A base elegível usa o valor final pago pelos produtos do pedido indicado, depois de descontos e sem frete.
- O cashback normal do comprador segue a hierarquia: ajuste manual do pedido, senão campanha, senão produto.
- A recompensa do indicador é um lançamento separado no ledger e não multiplica silenciosamente o cashback do comprador.
- O valor, percentual, teto e validade da recompensa do indicador pertencem à versão da campanha de indicação.
- Bônus manual concedido pelo Junior exige motivo, valor ou percentual, validade, confirmação e auditoria.

## 6. Fluxos

### Cliente

1. Indicador copia seu link ou código no painel; o compartilhamento permanece manual.
2. Indicado acessa a loja pelo link, que preserva o código durante a navegação e o preenche no checkout, ou informa o código manualmente.
3. Sistema valida o vínculo sem prometer recompensa definitiva.
4. Pedido é registrado e o WhatsApp é aberto para continuidade humana.
5. Depois da quitação, o sistema libera as recompensas elegíveis.

### Administração

1. Criar campanha com período, público, benefício, limites e regra de expiração.
2. Simular custo e margem pela SPEC-015.
3. Publicar por feature flag conforme SPEC-020.
4. Acompanhar indicações válidas, previstas, liberadas, bloqueadas e revertidas.
5. Analisar alertas e aplicar bônus manual quando necessário.

## 7. Antifraude e privacidade

- Comparar somente sinais necessários, como conta autenticada, telefone e e-mail normalizados e outros sinais aprovados.
- Não expor ao indicador os dados pessoais completos do indicado.
- Tentativas repetidas, múltiplas contas relacionadas e padrões anormais entram em revisão.
- Bloqueio antifraude não apaga o vínculo; registra regra, evidência mínima e decisão.
- Retenção e aviso de privacidade seguem a política vigente e devem passar por revisão jurídica.

## 8. Dados conceituais

- `referral_codes`: proprietário, código, estado e validade.
- `referral_links`: indicador, indicado, campanha, origem, estado e timestamps.
- `referral_rewards`: pedido, beneficiário, base, regra, valor, estado e reversão.
- `referral_reviews`: sinal, decisão, motivo e responsável.

Todas as entidades pertencem ao tenant e possuem auditoria.

## 9. Critérios de aceite

- Código válido cria um único vínculo antes da primeira compra.
- Autoindicação e cliente já existente não geram recompensa.
- Pagamento parcial mantém o benefício previsto.
- Quitação integral libera uma única vez.
- Cancelamento ou estorno reverte o valor relacionado.
- Limites impedem novos benefícios sem alterar recompensas já legítimas.
- Bônus manual aparece no extrato com autor e motivo.
- O custo da campanha aparece no guardião financeiro.

## 10. Testes obrigatórios

- Primeiro pedido, pedido repetido, código inválido, expirado e revogado.
- Autoindicação, duplicidade de identidade e vínculo circular.
- Pagamento parcial, integral, cancelamento e estorno.
- Concorrência entre quitação e rotina de recompensa.
- Limites diários/mensais, validade e arredondamento.
- Isolamento por tenant, permissões e mascaramento.
- Fluxo E2E da indicação até o extrato, sem envio automático de WhatsApp.

## 11. Decisões de configuração pendentes

- Percentual ou valor, teto e validade da recompensa.
- Definição operacional de “cliente novo”.
- Limites por indicador e por período.
- Sinais antifraude adicionais permitidos.
