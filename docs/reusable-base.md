# Base para instalação isolada

O fluxo principal deste repositório agora é o SaaS multiempresa descrito em
[saas-white-label.md](saas-white-label.md). Use o gerador abaixo somente quando
um cliente precisar de repositório, banco e deploy completamente separados.

## Criar a cópia

```powershell
pnpm create:client -- `
  --name "Loja Exemplo" `
  --destination "..\Loja Exemplo" `
  --email "contato@lojaexemplo.com.br" `
  --whatsapp "5531999999999" `
  --primary "#6d28d9" `
  --secondary "#a78bfa" `
  --order-prefix "LE"
```

O destino deve ser uma pasta vazia fora do projeto-base. O gerador não copia
`.git`, `node_modules`, builds, tokens de deploy ou o `.env.local` atual. Ele
cria a identidade inicial, um catálogo genérico, seed e variáveis próprias.

Use `--keep-catalog` apenas quando quiser manter deliberadamente o catálogo da
Junior Imports. Para consultar todos os argumentos:

```powershell
pnpm create:client -- --help
```

## Quando usar cada modelo

| SaaS multiempresa | Instalação isolada |
| --- | --- |
| um deploy atende vários clientes | um deploy por cliente |
| manutenção e evolução centralizadas | customização irrestrita por cliente |
| dados isolados por `tenant_id` e RLS | banco Supabase exclusivo |
| menor custo operacional | maior isolamento de infraestrutura |
| provisionamento pelo console `/saas` | provisionamento pelo terminal |

## Arquivos do gerador

- `src/config/platform.ts`: fallbacks técnicos da instalação;
- `src/data/seed.generic.ts`: catálogo inicial genérico;
- `supabase/seed.generic.sql`: seed para uma instalação separada;
- `scripts/create-client.mjs`: criação da cópia;
- `.env.example`: contrato de configuração.

O checkout registra o pedido e o encaminha ao WhatsApp. Gateway de pagamento,
emissão fiscal, ERP, logística e disparos automáticos pela API oficial do
WhatsApp continuam fora do escopo desta base.
