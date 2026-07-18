import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  decryptBackupFile,
  loadLocalEnvironment,
  requireBackupConfiguration,
  resolveBackupKey,
  restoreOrder,
} from "./backup-lib.mjs";

loadLocalEnvironment();
const fileArgument = process.argv.find((argument) => argument.endsWith(".jibackup"));
if (!fileArgument) throw new Error("Informe o arquivo .jibackup.");
const filePath = resolve(fileArgument);
if (!existsSync(filePath)) throw new Error("Arquivo de backup não encontrado.");
const apply = process.argv.includes("--apply");
const { key } = resolveBackupKey();
const { envelope, payload } = decryptBackupFile(filePath, key);
const tableSummary = Object.fromEntries(Object.entries(payload.tables).map(([table, rows]) => [table, rows.length]));

if (!apply) {
  console.log(JSON.stringify({ status: "verified", mode: "dry-run", tenant: envelope.tenant, createdAt: envelope.createdAt, checksum: envelope.checksum, tables: tableSummary, mediaCount: payload.media.length }));
  process.exit(0);
}

const { url, serviceRoleKey, tenantSlug } = requireBackupConfiguration();
if (process.env.JUNIOR_RESTORE_CONFIRM !== tenantSlug || envelope.tenant.slug !== tenantSlug) throw new Error(`Para restaurar, defina JUNIOR_RESTORE_CONFIRM=${tenantSlug} e use um backup do mesmo tenant.`);
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
for (const table of restoreOrder) {
  const rows = payload.tables[table] ?? [];
  for (let index = 0; index < rows.length; index += 200) {
    const immutableLedger = table === "cashback_entries" || table === "cashback_allocations";
    const { error } = await supabase.from(table).upsert(
      rows.slice(index, index + 200),
      immutableLedger ? { onConflict: "id", ignoreDuplicates: true } : undefined,
    );
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
for (const media of payload.media) {
  const { error } = await supabase.storage.from(media.bucket).upload(media.path, Buffer.from(media.data, "base64"), { contentType: media.contentType, upsert: true });
  if (error) throw new Error(`${media.bucket}/${media.path}: ${error.message}`);
}
const { error: verifyError } = await supabase.from("backup_runs").insert({ tenant_id: envelope.tenant.id, status: "verified", backup_type: "logical_encrypted", storage_label: `restore:${filePath.split("/").pop()}`, file_sha256: envelope.checksum, key_fingerprint: envelope.keyFingerprint, table_count: Object.keys(tableSummary).length, row_count: Object.values(tableSummary).reduce((sum, count) => sum + count, 0), media_count: payload.media.length, actor_email: process.env.JUNIOR_BACKUP_ACTOR?.trim() || "codex-local", notes: "Restauração lógica aplicada com confirmação explícita." });
if (verifyError) throw new Error(`Dados restaurados, mas o registro da operação falhou: ${verifyError.message}`);
console.log(JSON.stringify({ status: "restored", tenant: envelope.tenant, tables: tableSummary, mediaCount: payload.media.length }));
