# SPEC-021 — Operação móvel, código de barras, voz e reversão

## 1. Contexto e problema

Parte da rotina acontece longe do computador: conferir produto, movimentar estoque, localizar pedido e registrar informação rápida. A experiência móvel precisa economizar toques sem transformar conveniência em risco.

## 2. Objetivo

Adicionar leitura de código de barras, comandos de voz como rascunho e reversões seguras para ações compatíveis, mantendo confirmação humana e auditoria.

## 3. Leitura de código de barras

- A PWA solicita acesso à câmera somente ao abrir o leitor.
- O código localiza produto ou variante dentro do tenant.
- Resultado mostra nome, imagem, estoque e ação pretendida antes de qualquer movimento.
- Código desconhecido permite buscar produto e, com permissão, associar o código após confirmação.
- Múltiplas leituras rápidas possuem debounce e feedback visual/sonoro acessível.
- Entrada, saída, perda e conferência seguem as regras existentes de motivo, lote e auditoria.

## 4. Comandos de voz

- Voz é convertida em rascunho estruturado, nunca em execução automática.
- O sistema apresenta o que entendeu: entidade, quantidade, valor, motivo e ação.
- Ambiguidade gera pergunta ou resultados de busca; não escolhe por aproximação silenciosa.
- Pedido, pagamento, estoque, cashback e financeiro exigem a mesma confirmação da interface manual.
- Áudio bruto não é retido por padrão; política diferente exige configuração e aviso explícitos.

Exemplos de intenção: buscar pedido, consultar estoque, preparar mensagem, criar tarefa e preparar movimento de estoque.

## 5. Desfazer e reversão

- `Desfazer` imediato é permitido apenas para ações reversíveis e ainda não consolidadas.
- Operações financeiras, estoque definitivo, cashback liberado e cancelamentos usam fluxo de reversão explícito, com prévia de impacto e motivo.
- Reversão nunca apaga o evento original; cria evento compensatório ligado a ele.
- Janela de desfazer, permissões e ações elegíveis são configuráveis.
- A ação não pode ser revertida duas vezes.

## 6. Experiência móvel

- Alvos de toque adequados, uma coluna, teclado correto por campo e ações principais fixas sem cobrir conteúdo.
- Busca incremental substitui selects extensos de cliente e produto.
- Estados de carregamento, sucesso, erro e operação offline são explícitos.
- Leitura offline é permitida somente para dados seguros em cache; mutações aguardam conexão e nova confirmação.
- Tema claro/escuro, zoom, leitores de tela e orientação de aparelho são suportados.

## 7. Segurança e permissões

- Câmera e microfone são usados somente após gesto do usuário.
- O backend revalida tenant, permissão, versão e disponibilidade.
- Valores sensíveis nunca são confiados ao texto reconhecido no cliente.
- MFA ou confirmação reforçada continua obrigatório onde já definido.
- O plugin do ChatGPT e a voz seguem o mesmo contrato de preparação e confirmação.

## 8. Critérios de aceite

- Código válido localiza o produto certo e nunca movimenta estoque sozinho.
- Código desconhecido não cria associação sem permissão e confirmação.
- Voz ambígua não produz mutação.
- Rascunho confirmado gera o mesmo resultado da operação manual equivalente.
- Desfazer ou reverter preserva o histórico e restaura o efeito permitido uma única vez.
- Fluxos essenciais funcionam em celular pequeno sem zoom ou rolagem horizontal.

## 9. Testes obrigatórios

- Permissão de câmera/microfone concedida, negada e revogada.
- Código válido, desconhecido, duplicado e leituras consecutivas.
- Voz correta, ambígua, ruidosa e com valores conflitantes.
- Conexão instável, offline, retry e concorrência.
- Desfazer dentro/fora da janela e tentativa duplicada.
- Reversão financeira, de estoque e cashback com auditoria.
- Acessibilidade e responsividade em iOS, Android, tablet e desktop.

## 10. Fora de escopo

- Operação por voz totalmente autônoma.
- Sincronização offline de mutações sem nova validação.
- Exclusão do histórico original ao desfazer.
