# SPEC-019 — Continuidade, observabilidade e recuperação

## 1. Contexto e problema

Uma operação pronta para vender precisa detectar falhas rapidamente, proteger banco e arquivos e provar que consegue restaurar o serviço. Ter um botão de backup não substitui cópia externa, monitoramento e teste de recuperação.

## 2. Objetivo

Definir alertas externos, backups verificáveis, recuperação testada e uma visão simples de saúde para o Junior e para o responsável técnico.

## 3. Indicadores e alertas mínimos

- Falha ao registrar pedido.
- Erros repetidos no checkout ou na abertura do fluxo de WhatsApp.
- Indisponibilidade ou aumento anormal de erros do Supabase.
- Falha em pagamento parcial, estoque, cashback, kit ou indicação.
- Crescimento anormal de divergências críticas.
- Falha de backup, checksum, cópia externa ou teste de restauração.
- Falha de autenticação, MFA, plugin privado do ChatGPT ou deploy.

Alertas possuem severidade, deduplicação, janela, responsável, canal, reconhecimento e encerramento. O canal externo inicial é decisão de configuração; e-mail é o mínimo recomendado.

## 4. Observabilidade

- Logs estruturados com correlation ID por checkout, pedido e operação administrativa.
- Métricas de taxa de erro, latência, volume e saturação para rotas críticas.
- Eventos de negócio para pedido criado, pagamento, baixa de estoque, cashback e divergência.
- Segredos, tokens, códigos MFA e dados pessoais desnecessários nunca entram em logs.
- A Central de saúde mostra estado atual, última verificação, última falha e link para investigação.

## 5. Política de backup

- Backup do banco em frequência compatível com o RPO aprovado.
- Cópia criptografada fora do ambiente principal, com checksum e retenção definida.
- Backup separado dos objetos do Storage, pois o backup do banco não inclui os arquivos armazenados.
- Registro de data, escopo, tamanho, checksum, destino, resultado e responsável.
- Acesso ao botão administrativo de backup protegido por MFA e permissão específica.
- Nenhuma chave de serviço ou material de criptografia é gravado no arquivo de backup ou no navegador.

## 6. Recuperação e teste

- Runbook cobre incidente, decisão de restaurar, responsáveis, comunicação, validação e retorno à operação.
- Teste de restauração em ambiente isolado pelo menos mensalmente no ciclo inicial.
- Verificar banco, autenticação, RLS, pedidos, pagamentos, estoque, cashback e amostra de arquivos.
- Registrar último backup válido e última restauração comprovada no painel.
- Restauração de produção exige MFA, prévia de impacto, confirmação reforçada e janela controlada.

## 7. RPO, RTO e modos degradados

- RPO e RTO são decisões explícitas, não valores presumidos.
- Se o banco estiver indisponível, a loja não confirma pedido como salvo.
- Se o WhatsApp não abrir, o pedido persistido continua disponível e o cliente recebe alternativa clara.
- Se o plugin falhar, o painel manual permanece operacional.
- Se um módulo novo falhar, sua feature flag permite desligamento sem afetar pedido, caixa ou estoque.

## 8. Critérios de aceite

- Falha crítica gera alerta externo deduplicado e rastreável.
- Painel diferencia serviço saudável, degradado e indisponível.
- Backup possui checksum válido e cópia externa verificável.
- Storage possui rotina própria e não é presumido dentro do backup do banco.
- Restauração mensal produz relatório de evidência e tempo real de recuperação.
- Logs permitem seguir uma operação ponta a ponta sem expor segredos.
- Falha de um provedor não cria pedido duplicado nem confirma ação inexistente.

## 9. Testes obrigatórios

- Falha simulada de banco, Auth, checkout, WhatsApp, plugin e deploy.
- Alertas repetidos, recuperação, reconhecimento e encerramento.
- Backup íntegro, corrompido, incompleto e sem acesso.
- Restauração isolada e validação de RLS/tenant.
- Rotação e revogação de credenciais.
- Modo degradado em desktop e mobile.

## 10. Fontes operacionais

- [Backups do Supabase](https://supabase.com/docs/guides/platform/backups)
- [Observability da Vercel](https://vercel.com/docs/observability)
- [Alerts da Vercel](https://vercel.com/docs/alerts)

## 11. Decisões de configuração pendentes

- RPO e RTO.
- Retenção e destino externo.
- Contratação ou ativação de PITR.
- Canal, plantão e responsáveis por severidade.
