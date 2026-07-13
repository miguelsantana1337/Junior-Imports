# Arquitetura proposta e implementada

## Camadas

1. **Interface** — rotas do App Router e componentes React separados entre
   loja, carrinho, checkout, painel administrativo e elementos de UI.
2. **Estado do cliente** — providers de loja, carrinho e notificações. No modo
   local, dados demonstrativos são persistidos no `localStorage`.
3. **Domínio** — tipos, validações e regras puras de carrinho, desconto, estoque,
   frete e formatação.
4. **Dados** — leitura no servidor e operações administrativas pelo cliente
   autenticado. A ausência de configuração ativa os dados-semente locais.
5. **Supabase** — autenticação, Postgres, RLS, função transacional de pedidos e
   buckets públicos com escrita restrita a administradores.

## Organização

```text
src/
  app/                  rotas públicas e administrativas
  components/
    admin/              CRUDs e dashboard
    cart/               carrinho lateral
    checkout/           checkout e confirmação
    providers/          estado compartilhado
    store/              vitrine e páginas de produto
    ui/                 elementos visuais reutilizáveis
  data/                 dados-semente demonstrativos
  lib/                  domínio, validação e Supabase
  types/                contratos TypeScript
supabase/
  migrations/           esquema, funções e políticas RLS
  seed.sql              carga demonstrativa
tests/e2e/              fluxos Playwright
```

## Fluxos de dados

- A página lê o catálogo no servidor. Se o Supabase não estiver configurado,
  recebe uma cópia dos dados-semente.
- O carrinho permanece no navegador e nunca representa uma venda real.
- No checkout com Supabase, `create_demo_order` busca os produtos atuais,
  valida estoque e recalcula todos os valores no banco.
- O painel verifica a sessão no servidor e confirma o papel `admin` antes de
  renderizar qualquer rota protegida.
- Uploads são gravados nos buckets `product-media` e `banner-media`; apenas
  administradores podem inserir, alterar ou apagar objetos.
