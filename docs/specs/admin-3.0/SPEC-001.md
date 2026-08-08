# SPEC-001 — Navegação orientada à operação

## 1. Problema

A navegação anterior expunha módulos demais, com nomes técnicos e áreas ainda não necessárias para a rotina atual.

## 2. Estrutura aprovada

- Hoje: Prioridades do dia.
- Operação: Pedidos, Carrinhos abandonados, Clientes, Tarefas e contatos.
- Gestão: Caixa e resultados, Estoque e lotes, Relatórios.
- Loja: Editor, Produtos, Categorias.
- Marketing: Cupons, Campanhas e automações.
- Administração: acessos, segurança, loja, frete, backup e auditoria.

## 3. Alterações deste lançamento

- Página inicial do painel renomeada para **Hoje**.
- Dashboard mostra até três prioridades acionáveis.
- Financeiro renomeado para **Caixa e resultados**.
- Compras/fornecedores e Equipe/aprovações saem do menu.
- URLs antigas desses dois módulos redirecionam para Hoje.
- Nenhuma tabela ou registro desses módulos é apagado.

## 4. Critérios de aceite

- O usuário encontra pedidos e caixa pelo vocabulário do dia a dia.
- O menu não oferece criação de compras, fornecedores, equipe ou aprovações.
- Links antigos não exibem telas parcialmente suportadas.
- As prioridades de Hoje levam ao filtro correspondente.
