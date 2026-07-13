# Junior Imports — e-commerce demonstrativo

Migração completa do protótipo estático da Junior Imports para Next.js, React e
TypeScript. A aplicação preserva a identidade visual escura e azul, adiciona
páginas de produto, carrinho, checkout, pedidos demonstrativos e um painel
administrativo responsivo.

> Este projeto é exclusivamente demonstrativo. Ele não realiza vendas,
> cobranças, separação de mercadorias ou entregas reais.

## Recursos

- vitrine responsiva com busca, filtros, favoritos e banners rotativos;
- páginas individuais de produtos;
- carrinho persistente, cupons, frete e desconto Pix simulados;
- checkout validado e comprovante de pedido demonstrativo;
- painel protegido com dashboard, pedidos e configurações;
- cadastro, edição, exclusão, ocultação e ordenação de produtos;
- gestão e ordenação de banners, categorias e seções da página inicial;
- gestão de cupons e status dos pedidos;
- upload de imagens para o Supabase Storage;
- modo local funcional, sem depender de serviços externos;
- testes unitários e testes de ponta a ponta para os fluxos principais.

## Tecnologias

- Next.js com App Router e TypeScript;
- React Hook Form e Zod;
- Supabase Auth, Postgres, Row Level Security e Storage;
- Vitest, Testing Library e Playwright;
- ESLint.

## Execução local

Requisitos: Node.js 20.9 ou superior e pnpm.

```bash
pnpm install
copy .env.example .env.local
pnpm dev
```

A loja abre em `http://localhost:3000`. Sem variáveis do Supabase, o sistema
entra automaticamente no modo local e salva alterações no navegador.

Painel local: `http://localhost:3000/admin`

- e-mail: `admin@juniorimports.demo`
- senha: `junior123`

As credenciais podem ser alteradas em `.env.local`.

## Configuração do Supabase

1. Crie um projeto no Supabase.
2. Aplique as migrações com `pnpm dlx supabase@latest db push`.
3. Execute `supabase/seed.sql` para carregar os dados demonstrativos.
4. Copie a URL e a chave publicável para `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta-do-servidor
```

5. Crie o usuário administrador em Authentication > Users.
6. Promova esse usuário no SQL Editor, substituindo o e-mail:

```sql
update public.profiles
set role = 'owner',
    permissions = array['dashboard', 'orders', 'catalog', 'store', 'marketing', 'settings', 'data', 'users']
where id = (select id from auth.users where email = 'admin@exemplo.com');
```

As políticas RLS permitem leitura pública somente do catálogo ativo. Operações
administrativas exigem um usuário autenticado e as permissões correspondentes
em `profiles.permissions`. A chave de serviço nunca deve ser exposta no cliente.
Pedidos públicos são criados pela função `create_demo_order`, que recalcula
preço, cupom, frete e estoque no banco antes de registrar a simulação.

## Comandos de qualidade

```bash
pnpm typecheck
pnpm lint
pnpm test:run
pnpm test:e2e
pnpm build
```

## Rotas principais

| Rota | Função |
| --- | --- |
| `/` | Página inicial e catálogo |
| `/produtos/[slug]` | Página individual do produto |
| `/checkout` | Checkout demonstrativo |
| `/pedidos/[code]` | Confirmação do pedido |
| `/admin/login` | Autenticação administrativa |
| `/admin` | Dashboard |
| `/admin/products` | Produtos |
| `/admin/users` | Usuários, cargos e permissões |
| `/admin/banners` | Banners rotativos |
| `/admin/categories` | Categorias |
| `/admin/sections` | Seções da página inicial |
| `/admin/coupons` | Cupons |
| `/admin/orders` | Pedidos e status |
| `/admin/settings` | Configurações da loja |
| `/admin/data` | Backup e manutenção local |

## Documentação

- [Auditoria do protótipo](docs/prototype-audit.md)
- [Arquitetura](docs/architecture.md)
- [Plano de migração](docs/migration-plan.md)

O protótipo original foi mantido sem alterações em
`C:\Users\migue\Downloads\junior-imports-v3-corrigida\junior-imports-v3`.
