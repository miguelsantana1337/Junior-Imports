# Auditoria visual do painel administrativo

Data: 2026-07-13

## Escopo observado

- Visão geral em `/admin`.
- Catálogo em `/admin/products`.
- Cadastro de novo produto.
- Estrutura visual e tokens em `src/app/globals.css`.
- Componentes `admin-shell.tsx`, `dashboard-admin.tsx`, `products-admin.tsx` e `admin-ui.tsx`.

## O que deve ser preservado

- Identidade Junior Imports com azul elétrico `#1677ff`, azul-marinho e assinatura `JI`.
- Navegação lateral e separação clara das áreas administrativas.
- CRUD existente, ordenação, visibilidade, destaque e upload de imagens.
- Integração atual com Supabase e indicação explícita do ambiente conectado.
- Aviso de operação demonstrativa, sem vendas reais.

## Achados principais

1. A interface usa superfícies escuras em quase todos os níveis. Isso reduz a diferenciação entre navegação, conteúdo, tabelas e formulários.
2. A visão geral prioriza quatro métricas vazias e um gráfico sem dados, mas não oferece tarefas, atalhos ou orientações para configurar e operar a loja.
3. Em 1440 px, o painel de métricas fica apertado e a hierarquia visual perde clareza.
4. O catálogo não possui busca, filtros, seleção em massa ou resumo de estoque/status. Ações repetidas em cada linha aumentam o ruído.
5. A ordenação por setas funciona, porém é lenta para catálogos maiores e não deixa claro o modo de organização.
6. O cadastro de produto é um modal longo, com campos de publicação, mídia, precificação e conteúdo misturados no mesmo bloco.
7. Labels e textos auxiliares têm contraste e tamanho baixos, especialmente em tabelas e formulários.
8. O painel é funcional e responsivo, mas falta uma versão operacional intermediária para tablet e uma experiência móvel orientada a tarefas.

## Direção de redesign

- Adotar uma base administrativa clara, com navegação azul-marinho e azul Junior Imports como cor de ação.
- Organizar a visão geral por tarefas, saúde da loja, métricas e atividade recente.
- Transformar o catálogo em uma área de trabalho com busca, filtros, seleção em massa e ações contextuais.
- Dividir o cadastro de produto em seções previsíveis: informações, mídia, preço/estoque, organização e publicação.
- Preservar todas as capacidades atuais; o redesign deve alterar apresentação e fluxo, não remover funções.
- Usar padrões operacionais inspirados em plataformas de e-commerce maduras, sem copiar marca, logotipo, paleta ou composição proprietária da Nuvemshop.

## Evidências

- `01-current-dashboard.jpg`
- `02-current-products.jpg`
- `03-current-product-form.jpg`
