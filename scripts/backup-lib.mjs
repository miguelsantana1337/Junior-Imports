import { createHash, createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";

export const backupFormat = "junior-imports-encrypted-backup";
export const backupVersion = 1;
export const tenantTables = [
  "store_settings",
  "categories",
  "products",
  "banners",
  "home_sections",
  "coupons",
  "trust_items",
  "benefits",
  "faqs",
  "customers",
  "customer_tasks",
  "customer_contacts",
  "cashback_campaigns",
  "orders",
  "order_items",
  "cashback_entries",
  "cashback_allocations",
  "coupon_redemptions",
  "catalog_imports",
  "financial_transactions",
  "inventory_movements",
  "product_lots",
  "suppliers",
  "purchase_orders",
  "purchase_order_items",
  "store_pages",
  "page_blocks",
  "message_automations",
  "message_logs",
  "order_stock_reservations",
  "storefront_order_requests",
  "audit_logs",
  "backup_runs",
];

export const restoreOrder = [
  "tenants",
  "profiles",
  "tenant_members",
  "tenant_domains",
  "store_settings",
  "categories",
  "products",
  "banners",
  "home_sections",
  "coupons",
  "trust_items",
  "benefits",
  "faqs",
  "customers",
  "customer_tasks",
  "customer_contacts",
  "cashback_campaigns",
  "orders",
  "order_items",
  "cashback_entries",
  "cashback_allocations",
  "coupon_redemptions",
  "catalog_imports",
  "financial_transactions",
  "inventory_movements",
  "product_lots",
  "suppliers",
  "purchase_orders",
  "purchase_order_items",
  "store_pages",
  "page_blocks",
  "message_automations",
  "message_logs",
  "order_stock_reservations",
  "storefront_order_requests",
  "audit_logs",
  "backup_runs",
];

export function loadLocalEnvironment(workdir = process.cwd()) {
  const environmentFile = process.env.JUNIOR_ENV_FILE?.trim()
    ? resolve(process.env.JUNIOR_ENV_FILE)
    : join(workdir, ".env.local");
  if (!existsSync(environmentFile)) return;
  for (const rawLine of readFileSync(environmentFile, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

export function requireBackupConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const tenantSlug = process.env.NEXT_PUBLIC_CLIENT_ID?.trim() || "junior-imports";
  if (!url || !serviceRoleKey) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local.");
  return { url, serviceRoleKey, tenantSlug };
}

export function resolveBackupDirectory() {
  const configured = process.env.JUNIOR_BACKUP_DIR?.trim();
  const directory = resolve(configured || join(homedir(), "Documents", "Junior Imports Backups"));
  if (!isAbsolute(directory) || directory === "/" || directory === homedir()) throw new Error("Diretório de backup inseguro.");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  return directory;
}

export function resolveBackupKey() {
  const configured = process.env.JUNIOR_BACKUP_KEY?.trim();
  if (configured) {
    const decoded = Buffer.from(configured, "base64");
    if (decoded.length !== 32) throw new Error("JUNIOR_BACKUP_KEY deve conter 32 bytes em Base64.");
    return { key: decoded, source: "environment" };
  }

  const keyPath = join(homedir(), "Library", "Application Support", "Junior Imports", "backup.key");
  mkdirSync(dirname(keyPath), { recursive: true, mode: 0o700 });
  if (!existsSync(keyPath)) writeFileSync(keyPath, randomBytes(32).toString("base64"), { mode: 0o600, flag: "wx" });
  const key = Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
  if (key.length !== 32) throw new Error("A chave local de backup é inválida.");
  return { key, source: keyPath };
}

export function keyFingerprint(key) {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function encryptBackup(payload, key) {
  const plain = Buffer.from(JSON.stringify(payload));
  const compressed = gzipSync(plain, { level: 9 });
  const checksum = createHash("sha256").update(plain).digest("hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(compressed), cipher.final()]);
  return {
    format: backupFormat,
    version: backupVersion,
    createdAt: payload.createdAt,
    tenant: { id: payload.tenant.id, slug: payload.tenant.slug, name: payload.tenant.name },
    algorithm: "aes-256-gcm+gzip",
    keyFingerprint: keyFingerprint(key),
    checksum,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: encrypted.toString("base64"),
  };
}

export function decryptBackupFile(filePath, key) {
  const envelope = JSON.parse(readFileSync(filePath, "utf8"));
  if (envelope.format !== backupFormat || envelope.version !== backupVersion) throw new Error("Formato de backup incompatível.");
  if (envelope.keyFingerprint !== keyFingerprint(key)) throw new Error("A chave não corresponde a este backup.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const compressed = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  const plain = gunzipSync(compressed);
  const checksum = createHash("sha256").update(plain).digest("hex");
  if (checksum !== envelope.checksum) throw new Error("Checksum inválido: o arquivo foi alterado ou corrompido.");
  const payload = JSON.parse(plain.toString("utf8"));
  return { envelope, payload };
}
