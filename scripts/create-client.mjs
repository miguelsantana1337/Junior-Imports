import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(scriptDirectory, "..");

function parseArgs(values) {
  const args = new Map();
  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (item === "--") continue;
    if (!item.startsWith("--")) throw new Error(`Argumento inválido: ${item}`);
    const key = item.slice(2);
    if (key === "help" || key === "keep-catalog") {
      args.set(key, true);
      continue;
    }
    const value = values[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Informe um valor para --${key}.`);
    args.set(key, value);
    index += 1;
  }
  return args;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function orderPrefix(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 5);
}

function initials(name) {
  const words = name.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (words.length > 1) return words.slice(0, 4).map((word) => word[0]).join("").toUpperCase();
  return (words[0] ?? "LOJA").slice(0, 2).toUpperCase();
}

function envValue(value) {
  return `"${String(value).replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function sqlValue(value) {
  return String(value).replaceAll("'", "''");
}

function xmlValue(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function assertColor(value, argument) {
  if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`${argument} deve usar o formato #RRGGBB.`);
  return value.toLowerCase();
}

async function pathExists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function help() {
  return `
Cria uma nova instância white-label da plataforma.

Uso:
  pnpm create:client -- --name "Loja Exemplo" --destination "../Loja Exemplo"

Obrigatórios:
  --name             Nome público da loja
  --destination      Pasta nova, preferencialmente ao lado deste projeto

Opcionais:
  --slug              Identificador técnico (padrão: derivado do nome)
  --email             E-mail público da loja
  --whatsapp          WhatsApp com DDI e DDD, somente números
  --primary           Cor principal #RRGGBB
  --secondary         Cor secundária #RRGGBB
  --order-prefix      Prefixo de pedidos e SKUs, até 5 caracteres
  --admin-email       Login do painel no modo local
  --admin-password    Senha do painel no modo local
  --keep-catalog      Mantém o catálogo da Junior Imports em vez do genérico
`;
}

const args = parseArgs(process.argv.slice(2));
if (args.has("help")) {
  process.stdout.write(help());
  process.exit(0);
}

const name = String(args.get("name") ?? "").trim();
const destinationInput = String(args.get("destination") ?? "").trim();
if (!name || !destinationInput) throw new Error(`--name e --destination são obrigatórios.\n${help()}`);

const slug = slugify(String(args.get("slug") ?? name));
if (!slug) throw new Error("Não foi possível gerar um slug válido para o cliente.");

const prefix = orderPrefix(String(args.get("order-prefix") ?? initials(name)));
if (!prefix) throw new Error("Não foi possível gerar um prefixo de pedido válido.");

const destination = path.resolve(process.cwd(), destinationInput);
const relativeDestination = path.relative(sourceRoot, destination);
if (!relativeDestination.startsWith("..") && !path.isAbsolute(relativeDestination)) {
  throw new Error("A pasta de destino deve ficar fora do projeto-base para evitar uma cópia recursiva.");
}

if (await pathExists(destination)) {
  const entries = await readdir(destination);
  if (entries.length) throw new Error(`A pasta de destino não está vazia: ${destination}`);
} else {
  await mkdir(destination, { recursive: true });
}

const email = String(args.get("email") ?? `contato@${slug}.com.br`).trim();
const whatsapp = String(args.get("whatsapp") ?? "5500000000000").replace(/\D/g, "");
const primary = assertColor(String(args.get("primary") ?? "#1677ff"), "--primary");
const secondary = assertColor(String(args.get("secondary") ?? "#69a8ff"), "--secondary");
const adminEmail = String(args.get("admin-email") ?? `admin@${slug}.demo`).trim();
const adminPassword = String(args.get("admin-password") ?? `${prefix.toLowerCase()}-demo-123`).trim();
const couponCode = `${prefix}10`;

const excludedRoots = new Set([
  ".agents",
  ".codex",
  ".git",
  ".next",
  ".vercel",
  "node_modules",
  "test-results",
]);
const excludedFiles = new Set([".env.local", "tsconfig.tsbuildinfo"]);
const excludedAuditDirectories = new Set([
  "docs/admin-system-audit",
  "docs/design-audit",
  "docs/design-qa",
]);

await cp(sourceRoot, destination, {
  recursive: true,
  filter(source) {
    const relative = path.relative(sourceRoot, source).replaceAll("\\", "/");
    if (!relative) return true;
    const [root] = relative.split("/");
    if (excludedRoots.has(root) || excludedFiles.has(relative)) return false;
    return ![...excludedAuditDirectories].some((directory) => relative === directory || relative.startsWith(`${directory}/`));
  },
});

if (!args.has("keep-catalog")) {
  const genericSeed = await readFile(path.join(destination, "src/data/seed.generic.ts"), "utf8");
  await writeFile(path.join(destination, "src/data/seed.ts"), genericSeed, "utf8");

  let genericSql = await readFile(path.join(destination, "supabase/seed.generic.sql"), "utf8");
  const sqlReplacements = {
    __STORE_NAME_SQL__: sqlValue(name),
    __WHATSAPP__: sqlValue(whatsapp),
    __STORE_EMAIL_SQL__: sqlValue(email),
    __PRIMARY_COLOR__: primary,
    __SECONDARY_COLOR__: secondary,
    __ORDER_PREFIX__: prefix,
    __COUPON_CODE__: couponCode,
    __ADMIN_EMAIL_SQL__: sqlValue(adminEmail),
  };
  for (const [marker, value] of Object.entries(sqlReplacements)) genericSql = genericSql.replaceAll(marker, value);
  await writeFile(path.join(destination, "supabase/seed.sql"), genericSql, "utf8");
}

const platformConfigPath = path.join(destination, "src/config/platform.ts");
let platformSource = await readFile(platformConfigPath, "utf8");
const platformReplacements = new Map([
  ['"junior-imports"', JSON.stringify(slug)],
  ['"Junior Imports"', JSON.stringify(name)],
  ['"JI"', JSON.stringify(prefix)],
  ['"/admin-brand.png"', JSON.stringify("/client-brand.svg")],
  ['"/favicon.svg"', JSON.stringify("/client-brand.svg")],
  ['"5531999999999"', JSON.stringify(whatsapp)],
  ['"contato@juniorimports.com.br"', JSON.stringify(email)],
  ['"admin@juniorimports.demo"', JSON.stringify(adminEmail)],
  ['"junior123"', JSON.stringify(adminPassword)],
]);
for (const [currentValue, nextValue] of platformReplacements) {
  platformSource = platformSource.replaceAll(currentValue, nextValue);
}
await writeFile(platformConfigPath, platformSource, "utf8");

const initialMigrationPath = path.join(destination, "supabase/migrations/202607130001_initial.sql");
let initialMigration = await readFile(initialMigrationPath, "utf8");
initialMigration = initialMigration.replaceAll("'JI-'", `'${prefix}-'`);
await writeFile(initialMigrationPath, initialMigration, "utf8");

const builderMigrationPath = path.join(destination, "supabase/migrations/202607130002_store_builder.sql");
let builderMigration = await readFile(builderMigrationPath, "utf8");
builderMigration = builderMigration.replaceAll("Junior Imports", sqlValue(name));
await writeFile(builderMigrationPath, builderMigration, "utf8");

const saasMigrationPath = path.join(destination, "supabase/migrations/202607130005_saas_multitenant_whatsapp.sql");
let saasMigration = await readFile(saasMigrationPath, "utf8");
saasMigration = saasMigration
  .replaceAll("'junior-imports'", `'${sqlValue(slug)}'`)
  .replaceAll("'Junior Imports'", `'${sqlValue(name)}'`)
  .replace("default 'JI' check (order_prefix", `default '${sqlValue(prefix)}' check (order_prefix`);
await writeFile(saasMigrationPath, saasMigration, "utf8");

const packagePath = path.join(destination, "package.json");
const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
packageJson.name = `${slug}-ecommerce`;
packageJson.version = "1.0.0";
await writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

const environment = `# Identidade white-label
NEXT_PUBLIC_CLIENT_ID=${envValue(slug)}
NEXT_PUBLIC_STORE_NAME=${envValue(name)}
NEXT_PUBLIC_ORDER_PREFIX=${envValue(prefix)}
NEXT_PUBLIC_DEFAULT_CHECKOUT_MODE="whatsapp"
NEXT_PUBLIC_STORE_WHATSAPP=${envValue(whatsapp)}
NEXT_PUBLIC_STORE_EMAIL=${envValue(email)}
NEXT_PUBLIC_PRIMARY_COLOR=${envValue(primary)}
NEXT_PUBLIC_SECONDARY_COLOR=${envValue(secondary)}
NEXT_PUBLIC_DEFAULT_LOGO_URL=${envValue("/client-brand.svg")}
NEXT_PUBLIC_DEFAULT_FAVICON_URL=${envValue("/client-brand.svg")}

# Login exibido somente no modo local demonstrativo
NEXT_PUBLIC_DEMO_ADMIN_NAME=${envValue("Administrador Demo")}
NEXT_PUBLIC_DEMO_ADMIN_EMAIL=${envValue(adminEmail)}
NEXT_PUBLIC_DEMO_ADMIN_PASSWORD=${envValue(adminPassword)}

# Preencha para conectar a instância própria do Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PLATFORM_ADMIN_EMAILS=${envValue(adminEmail)}
SAAS_ROOT_DOMAIN=
`;
await writeFile(path.join(destination, ".env.local"), environment, "utf8");
await writeFile(path.join(destination, ".env.example"), environment, "utf8");

const badge = initials(name);
const brandSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${xmlValue(name)}">
  <rect width="256" height="256" rx="52" fill="${primary}"/>
  <text x="128" y="145" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="88" font-weight="800">${xmlValue(badge)}</text>
</svg>
`;
await writeFile(path.join(destination, "public/client-brand.svg"), brandSvg, "utf8");

const readme = `# ${name} — e-commerce com pedidos pelo WhatsApp

Instância white-label criada a partir da base Junior Imports.

## Rodar localmente

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

- Loja: http://localhost:3000
- Painel: http://localhost:3000/admin
- Login local: \`${adminEmail}\`
- Senha local: \`${adminPassword}\`

## Personalização

As configurações de identidade ficam em \`.env.local\`. Produtos, categorias,
banners, páginas, cupons, cores e dados operacionais podem ser alterados no
painel. O catálogo inicial é genérico e deve ser substituído antes da entrega.

## Supabase

Crie um projeto separado para este cliente, configure as três variáveis do
Supabase em \`.env.local\`, aplique as migrações e execute \`supabase/seed.sql\`.
Nunca reutilize banco, chaves de serviço ou usuários entre clientes.

## Operação

Esta base registra o pedido e abre a mensagem pronta no WhatsApp da loja. Ela
não processa cobrança, emissão fiscal, ERP ou entrega sem integrações adicionais.

Veja também [docs/reusable-base.md](docs/reusable-base.md).
`;
await writeFile(path.join(destination, "README.md"), readme, "utf8");

process.stdout.write(`
Cliente criado com sucesso.

Pasta: ${destination}
Cliente: ${name}
ID técnico: ${slug}
Prefixo: ${prefix}
Catálogo: ${args.has("keep-catalog") ? "Junior Imports" : "genérico"}

Próximos comandos:
  cd "${destination}"
  pnpm install
  pnpm dev
`);
