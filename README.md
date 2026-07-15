# White-label Commerce — base SaaS da Junior Imports

Plataforma multiempresa em Next.js e Supabase para criar e administrar lojas
white-label que recebem pedidos pelo WhatsApp. A Junior Imports continua como a
loja inicial, mas uma única instalação agora pode atender Autêntica e outros
clientes com dados, equipe, identidade e pedidos isolados.

## O que a plataforma entrega

- console central em `/saas` para provisionar e gerenciar clientes;
- vitrine individual em `/loja/[cliente]`;
- painel administrativo compartilhado, sempre limitado ao cliente selecionado;
- catálogo, páginas, banners, categorias, cupons e configurações por cliente;
- checkout que valida e registra o pedido no servidor e abre uma mensagem pronta
  no WhatsApp da loja;
- equipes, papéis, permissões e trilha de auditoria por cliente;
- roteamento por caminho, subdomínio e domínio personalizado;
- modo local para desenvolvimento e testes sem serviços externos.

O fluxo atual não cobra o consumidor. Pagamento, entrega e disponibilidade são
confirmados pelo cliente no atendimento do WhatsApp.

## Distribuição privada por link

As vitrines funcionam como catálogos compartilhados por indicação, WhatsApp,
Instagram ou link direto. O projeto declara `noindex, nofollow`, entrega o
cabeçalho `X-Robots-Tag` e publica um `robots.txt` que bloqueia os robôs em
geral. As únicas exceções são os agentes de prévia social do WhatsApp e da Meta,
necessários para montar o cartão do link. Conteúdo, páginas locais,
palavras-chave, Search Console e aquisição orgânica não fazem parte da
prioridade atual.

Esse bloqueio reduz a possibilidade de indexação, mas não protege o catálogo
como uma área sigilosa: qualquer pessoa com o link ainda pode acessá-lo. Para
restrição real será necessário adicionar autenticação ou links temporários à
vitrine.

Título, descrição, logo e imagem social continuam configurados para a prévia do
link em mensageiros. A URL da Vercel pode ser usada durante a validação; para
compartilhamento comercial, configure um domínio próprio e ajuste
`NEXT_PUBLIC_SITE_URL`.

## Execução local

Requisitos: Node.js 20.9 ou superior e pnpm.

```powershell
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

Sem as variáveis do Supabase, a aplicação usa dados locais no navegador. Esse
modo serve para desenvolvimento da loja Junior e não provisiona novos tenants.

Painel local: `http://localhost:3000/admin`

- e-mail: `admin@juniorimports.demo`
- senha: `junior123`

## Implantar o SaaS

1. Crie ou use um projeto Supabase.
2. Configure `.env.local` com a URL, chave publicável e chave de serviço.
3. Aplique todas as migrations, incluindo
   `202607130005_saas_multitenant_whatsapp.sql`.
4. Garanta que seu usuário tenha `is_platform_admin = true` ou inclua seu e-mail
   em `PLATFORM_ADMIN_EMAILS`.
5. Inicie a aplicação e acesse `/saas` para criar a primeira nova loja.

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta-do-servidor
PLATFORM_ADMIN_EMAILS="voce@suaagencia.com.br"
SAAS_ROOT_DOMAIN="lojas.suaagencia.com.br"
```

A chave de serviço é usada somente nas rotas de servidor para criar usuários e
provisionar tenants. Ela nunca pode ser exposta em variáveis `NEXT_PUBLIC_*`.

O passo a passo completo, inclusive para cadastrar a Autêntica, configurar
WhatsApp, subdomínio e domínio próprio, está em
[Operação do SaaS white-label](docs/saas-white-label.md).

## Rotas principais

| Rota | Função |
| --- | --- |
| `/saas` | Console do administrador da plataforma |
| `/loja/[cliente]` | Loja pública de um cliente |
| `/loja/[cliente]/checkout` | Registro e envio do pedido ao WhatsApp |
| `/admin/login` | Autenticação administrativa |
| `/admin` | Painel do cliente selecionado |
| `/admin/products` | Produtos e estoque |
| `/admin/orders` | Pedidos e status |
| `/admin/users` | Equipe, papéis e permissões |
| `/admin/settings` | Identidade, contato e WhatsApp |

## Qualidade

```powershell
pnpm typecheck
pnpm lint
pnpm test:run
pnpm test:e2e
pnpm build
```

## Alternativa: instalação isolada

Para um cliente que exija código, banco e deploy totalmente separados, ainda é
possível gerar uma cópia dedicada:

```powershell
pnpm create:client -- --name "Loja Exemplo" --destination "..\Loja Exemplo"
```

Esse não é o fluxo normal do SaaS. Consulte
[Base para instalação isolada](docs/reusable-base.md).

## Documentação

- [Operação do SaaS white-label](docs/saas-white-label.md)
- [Base para instalação isolada](docs/reusable-base.md)
- [Arquitetura original](docs/architecture.md)
- [Auditoria do protótipo](docs/prototype-audit.md)
