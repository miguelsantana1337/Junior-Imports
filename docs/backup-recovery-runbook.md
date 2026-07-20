# Runbook de backup e recuperação

Atualizado em 18/07/2026. Esta rotina cobre os dados comerciais da Junior Imports e as mídias dos produtos, banners e páginas.

## Objetivos operacionais

- **RPO:** no máximo 24 horas entre backups verificados.
- **RTO inicial:** até 2 horas para validar o incidente, abrir o pacote e executar a restauração lógica.
- **Retenção recomendada:** 7 cópias diárias e 4 cópias semanais em um dispositivo ou cofre diferente do computador operacional.

O Supabase informa WAL habilitado no projeto, mas o PITR não está ativo. Por isso, a cópia lógica criptografada continua obrigatória.

## O que o pacote contém

- Dados do tenant, catálogo, loja, CRM, pedidos, estoque, compras, mensagens e auditoria.
- Discussões, comentários, confirmações de leitura, aprovações, estado das notificações e telemetria do Copiloto.
- Perfis e vínculos da equipe que já existam no Supabase Auth.
- Arquivos dos buckets `product-media`, `banner-media` e `site-media`.
- Manifesto, quantidade de registros, checksum e impressão digital da chave.

Senhas, segredos MFA e sessões não são exportados. Esses itens pertencem ao Supabase Auth e precisam ser recuperados pelos procedimentos próprios da plataforma.

Presença online e travas temporárias de edição são dados efêmeros. Elas não entram no pacote e são recriadas automaticamente quando a equipe volta ao painel.

## Criação

### Pelo painel administrativo

O proprietário pode abrir **Sistema → Dados → Criar backup agora**. Para cada geração, o painel exige um novo código TOTP do aplicativo autenticador. Depois da confirmação, o servidor libera um manifesto temporário, o navegador baixa as mídias diretamente do Supabase, monta o pacote, criptografa, verifica a integridade e inicia o download do arquivo `.jibackup`.

O pacote criado pelo painel usa o formato binário v2 e uma chave de dados exclusiva. Essa chave é protegida pela chave mestra `JUNIOR_BACKUP_KEY`, que nunca é enviada ao navegador. A operação concluída fica registrada em `backup_runs` e na auditoria administrativa.

Não feche a aba enquanto o progresso estiver em andamento. Ao final, mova o arquivo baixado para a guarda externa definida na política de retenção.

### Pelo terminal

Em um terminal autenticado e com as variáveis do Supabase disponíveis:

```bash
pnpm backup:database
```

Por padrão, o pacote é gravado em `~/Documents/Junior Imports Backups` e a chave separada em `~/Library/Application Support/Junior Imports/backup.key`. Os dois arquivos usam permissão exclusiva do usuário. Também é possível fornecer:

- `JUNIOR_ENV_FILE`: arquivo de ambiente específico.
- `JUNIOR_BACKUP_DIR`: destino alternativo.
- `JUNIOR_BACKUP_KEY`: chave AES de 32 bytes em Base64 mantida em um cofre.
- `JUNIOR_BACKUP_ACTOR`: identificação do operador registrada no histórico.

Nunca guarde a única cópia da chave junto da única cópia do backup.

## Verificação sem alteração de dados

```bash
pnpm backup:verify -- "/caminho/arquivo.jibackup"
```

O comando descriptografa, descomprime, confere a chave, o checksum, o tenant, as tabelas e as mídias. Ele não se conecta ao banco nem grava informações.

## Restauração controlada

1. Preserve o banco afetado e registre o horário do incidente.
2. Execute primeiro a verificação sem alteração.
3. Confirme que o pacote pertence ao tenant `junior-imports`.
4. Garanta que os usuários necessários ainda existem no Supabase Auth.
5. Faça a restauração somente em uma janela de manutenção:

```bash
JUNIOR_RESTORE_CONFIRM=junior-imports pnpm backup:restore -- "/caminho/arquivo.jibackup"
```

A confirmação explícita e a coincidência do tenant são obrigatórias. A rotina usa `upsert`, restaura as tabelas em ordem de dependência e repõe as mídias. Ao final, registra a operação em `backup_runs`.

## Verificação pós-restauração

- Abrir `/admin/data` e conferir a Central de saúde.
- Validar contagens de produtos, pedidos, clientes e arquivos.
- Testar login com MFA de um administrador sem redefinir fatores existentes.
- Abrir a loja e conferir imagens, categorias e um pedido de teste sem pagamento.
- Registrar o resultado e o tempo total no histórico do incidente.

## Contingência e guarda externa

O pacote local é independente do banco, mas ainda precisa de uma segunda cópia fora deste Mac. A guarda recomendada é um cofre corporativo com criptografia e versionamento. Não enviar o arquivo ou a chave por WhatsApp, e-mail comum ou repositório Git.

O dump físico via Supabase CLI depende do Docker Desktop neste computador. Na ausência do Docker, a rotina lógica documentada acima é o procedimento oficial. Quando PITR ou um cofre externo forem contratados, este runbook deve ser atualizado e um teste de recuperação agendado a cada trimestre.
