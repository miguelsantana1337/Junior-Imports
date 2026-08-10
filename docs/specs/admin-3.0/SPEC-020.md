# SPEC-020 — Feature flags e publicação gradual

## 1. Contexto e problema

Indicação, kits, cashback, plugin e mudanças de checkout afetam áreas críticas. Publicar tudo para todos de uma vez aumenta o risco de lançamento e dificulta interromper uma falha.

## 2. Objetivo

Permitir ativação gradual, comparação de resultados e desligamento imediato sem depender de novo deploy.

## 3. Públicos suportados

- Somente Miguel.
- Miguel e Junior.
- Grupo de administradores selecionado.
- Todos os administradores.
- Grupo de clientes ou percentual controlado da loja.
- Toda a loja pública.

O mecanismo pode ser interno no banco ou usar um provedor compatível. A regra de negócio não depende do fornecedor escolhido.

## 4. Tipos de flag

- Booleano: ligada ou desligada.
- Variante: experiência A/B ou versão de fluxo.
- Percentual: distribuição estável por usuário ou sessão.
- Regra: papel, tenant, cliente, ambiente, período ou atributo aprovado.
- Kill switch: desliga imediatamente um módulo de risco.

## 5. Regras de segurança

- Flag controla disponibilidade, não substitui autenticação, RLS ou permissões.
- Valor padrão em falha é seguro e documentado por recurso.
- Funcionalidades não testadas ficam desligadas por padrão em produção.
- Alterar flag crítica exige permissão, motivo, confirmação e auditoria.
- Avaliação da flag ocorre também no servidor para operações protegidas.
- O cliente não consegue habilitar um recurso alterando JavaScript ou requisição.

## 6. Fluxo de publicação

1. Criar a flag e definir dono, objetivo, métrica, público e prazo.
2. Validar migração e compatibilidade com a flag desligada.
3. Ativar para equipe técnica.
4. Expandir para Junior e grupo interno.
5. Liberar percentual pequeno de clientes quando aplicável.
6. Acompanhar erros, divergências, conversão e impacto financeiro.
7. Expandir, pausar, reverter ou encerrar a flag.

## 7. Flags prioritárias

- Central de divergências e correções.
- Guardião financeiro de campanhas.
- Programa de indicação.
- Kit degustação e motor de kits.
- Novo funil e recuperação de carrinhos.
- Ações do plugin privado do ChatGPT.
- Ajuste manual de cashback e operações móveis.

## 8. Dados e auditoria

Registrar chave, descrição, dono, ambiente, público, variantes, regra, valor padrão, início/fim, estado, motivo, usuário e histórico. Eventos críticos guardam o valor da flag observado para reprodução.

## 9. Critérios de aceite

- A mesma pessoa recebe variante estável durante o experimento.
- Desligar a flag interrompe novas entradas sem corromper registros existentes.
- Permissões continuam válidas com a flag ligada.
- Falha do provedor usa o valor padrão seguro.
- Toda alteração crítica é auditável.
- O painel mostra quais recursos estão em teste e para quem.

## 10. Testes obrigatórios

- Flag desligada, ligada, percentual, variante e regra por papel.
- Avaliação no cliente e no servidor.
- Tentativa de contornar a flag.
- Falha/timeout do provedor e cache desatualizado.
- Rollback com pedidos, kits, indicação e cashback já existentes.
- Isolamento por ambiente e tenant.

## 11. Fonte de referência

- [Vercel Flags](https://vercel.com/docs/flags/vercel-flags)
