# Operação do SaaS white-label

## Visão geral

Uma única aplicação e um único projeto Supabase atendem várias lojas. Cada
cliente é um `tenant`; todas as tabelas operacionais possuem `tenant_id`, e as
políticas de Row Level Security limitam as leituras e alterações ao tenant que o
usuário pode administrar.

```text
Administrador da plataforma
  -> /saas
     -> Junior Imports -> /admin e /loja/junior-imports
     -> Autêntica      -> /admin e /loja/autentica
     -> Próximo cliente -> /admin e /loja/proximo-cliente
```

O catálogo público só é exibido quando o tenant está ativo ou em implantação.
Um tenant suspenso permanece no banco, mas deixa de publicar a loja.

## Preparar a infraestrutura

Configure estas variáveis no ambiente local e no provedor de hospedagem:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-chave-publicavel
SUPABASE_SERVICE_ROLE_KEY=sua-chave-secreta-do-servidor
PLATFORM_ADMIN_EMAILS="voce@suaagencia.com.br"
SAAS_ROOT_DOMAIN="lojas.suaagencia.com.br"
```

Em seguida, aplique as migrations em ordem:

```powershell
pnpm dlx supabase@latest db push
```

A migration `202607130005_saas_multitenant_whatsapp.sql`:

- cria tenants, membros e domínios;
- associa os dados existentes à Junior Imports;
- troca as restrições globais por restrições compostas com `tenant_id`;
- recria as políticas RLS com isolamento multiempresa;
- cria a função transacional de pedido público;
- cria a função restrita que provisiona uma loja completa.

Não execute o seed genérico sobre uma base que já possua dados da Junior
Imports. Ele é destinado somente a instalações novas ou geradas separadamente.

## Criar a Autêntica

1. Entre com o administrador da plataforma.
2. Acesse `/saas`.
3. Clique em **Novo cliente**.
4. Informe, por exemplo:

| Campo | Exemplo |
| --- | --- |
| Nome | Autêntica |
| Endereço | `autentica` |
| WhatsApp | `5531999999999` |
| E-mail comercial | `contato@autentica.com.br` |
| Prefixo | `AUT` |
| Responsável | nome do gestor da Autêntica |
| E-mail de acesso | e-mail individual do gestor |
| Senha temporária | senha inicial com pelo menos 8 caracteres |

O provisionamento ocorre em uma transação e cria configurações, página inicial,
conteúdo institucional básico, categorias e o vínculo do proprietário. O
catálogo começa vazio para evitar publicar produtos de outro cliente.

Depois de criar:

1. clique em **Gerenciar** no cartão da Autêntica;
2. cadastre produtos, categorias, banners e páginas;
3. em **Configurações**, ajuste logo, cores, contato e WhatsApp;
4. mantenha **Enviar para o WhatsApp** no fluxo do checkout;
5. teste a compra pública em `/loja/autentica`;
6. altere o status do tenant de **Implantação** para **Ativo**.

O usuário proprietário acessa `/admin/login`. No login, a plataforma seleciona
automaticamente um tenant permitido; administradores da plataforma podem trocar
de cliente pelo console `/saas`.

## Como o pedido pelo WhatsApp funciona

O navegador envia os itens, cliente e cupom para a RPC
`create_tenant_order`. O banco busca os preços atuais, recalcula desconto e
frete, valida o tenant e salva pedido e itens. Só então o navegador monta o link
`wa.me` para o número configurado e abre a mensagem.

O modelo da mensagem aceita:

- `{{loja}}`
- `{{pedido}}`
- `{{cliente}}`
- `{{itens}}`
- `{{total}}`

Esse desenho mantém o pedido no painel mesmo que o comprador feche o WhatsApp.
Preço final, estoque, pagamento e entrega ainda devem ser confirmados pelo
atendente.

## Endereços e domínios

### Caminho da plataforma

Funciona sem configuração de DNS:

```text
https://app.suaagencia.com.br/loja/autentica
```

### Subdomínio automático

Com `SAAS_ROOT_DOMAIN=lojas.suaagencia.com.br`, o proxy entende:

```text
https://autentica.lojas.suaagencia.com.br
```

Configure no DNS um registro curinga `*.lojas.suaagencia.com.br` apontando para
o deploy e cadastre o domínio curinga no provedor de hospedagem.

### Domínio próprio

A infraestrutura aceita domínios registrados em `tenant_domains`. Enquanto não
houver uma tela de verificação automática, faça o vínculo somente depois de
validar o DNS do cliente:

```sql
insert into public.tenant_domains (tenant_id, hostname, verified, is_primary)
select id, 'loja.autentica.com.br', true, true
from public.tenants
where slug = 'autentica';

update public.tenants
set primary_domain = 'loja.autentica.com.br'
where slug = 'autentica';
```

Não marque `verified = true` antes de confirmar que o domínio pertence ao
cliente e aponta para a aplicação.

## Segurança e isolamento

- operações administrativas exigem autenticação e permissão no tenant;
- o console `/saas` exige administrador global;
- provisionamento de tenant e usuário usa a chave de serviço no servidor;
- criação de pedidos públicos ocorre por RPC, sem aceitar preço informado pelo
  navegador;
- buckets de mídia usam o UUID do tenant no primeiro segmento do caminho;
- pedidos, logs e auditoria nunca são consultados sem filtro de tenant.

Antes de produção, use senhas individuais, habilite proteção adequada no
Supabase Auth, mantenha a chave de serviço apenas no servidor e faça backup do
banco.

## Limites atuais

Esta versão cobre gestão da vitrine e captação de pedidos pelo WhatsApp. Ainda
não inclui assinatura/cobrança do lojista, gateway de pagamento do consumidor,
NF-e, ERP, cotação logística, verificação automatizada de domínio ou envio
ativo pela API oficial do WhatsApp. Esses módulos podem ser adicionados sem
romper o isolamento por tenant já criado.
