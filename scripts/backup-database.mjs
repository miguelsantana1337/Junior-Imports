import { createHash } from "node:crypto";
import { statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import {
  decryptBackupFile,
  encryptBackup,
  loadLocalEnvironment,
  requireBackupConfiguration,
  resolveBackupDirectory,
  resolveBackupKey,
  tenantTables,
} from "./backup-lib.mjs";

loadLocalEnvironment();
const { url, serviceRoleKey, tenantSlug } = requireBackupConfiguration();
const backupDirectory = resolveBackupDirectory();
const { key, source: keySource } = resolveBackupKey();
const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function fetchAll(table, column, value) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").eq(column, value).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function fetchMedia(tenantId) {
  const media = [];
  async function fetchFolder(bucket, folder) {
    for (let offset = 0; ; offset += 1000) {
      const { data: objects, error } = await supabase.storage.from(bucket).list(folder, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`${bucket}/${folder}: ${error.message}`);
      for (const object of objects ?? []) {
        const path = `${folder}/${object.name}`;
        if (!object.id) {
          await fetchFolder(bucket, path);
          continue;
        }
        const { data, error: downloadError } = await supabase.storage.from(bucket).download(path);
        if (downloadError || !data) throw new Error(`${bucket}/${path}: ${downloadError?.message ?? "download indisponível"}`);
        media.push({ bucket, path, contentType: data.type || "application/octet-stream", data: Buffer.from(await data.arrayBuffer()).toString("base64") });
      }
      if (!objects || objects.length < 1000) break;
    }
  }
  for (const bucket of ["product-media", "banner-media", "site-media"]) await fetchFolder(bucket, tenantId);
  return media;
}

const { data: tenant, error: tenantError } = await supabase.from("tenants").select("*").eq("slug", tenantSlug).maybeSingle();
if (tenantError || !tenant) throw new Error(tenantError?.message ?? `Tenant ${tenantSlug} não encontrado.`);

const tables = { tenants: [tenant] };
for (const table of tenantTables) tables[table] = await fetchAll(table, "tenant_id", tenant.id);
tables.tenant_domains = await fetchAll("tenant_domains", "tenant_id", tenant.id);
tables.tenant_members = await fetchAll("tenant_members", "tenant_id", tenant.id);
const memberIds = [...new Set(tables.tenant_members.map((member) => member.user_id).filter(Boolean))];
if (memberIds.length) {
  const { data, error } = await supabase.from("profiles").select("*").in("id", memberIds);
  if (error) throw new Error(`profiles: ${error.message}`);
  tables.profiles = data ?? [];
} else tables.profiles = [];

const media = await fetchMedia(tenant.id);
const createdAt = new Date().toISOString();
const payload = {
  format: "junior-imports-logical-payload",
  version: 1,
  createdAt,
  tenant,
  tables,
  media,
  limitations: [
    "Auth passwords and MFA secrets are managed by Supabase Auth and are not included.",
    "Transient presence and edit-lock leases are intentionally excluded.",
  ],
};
const envelope = encryptBackup(payload, key);
const filename = `junior-imports-${createdAt.replace(/[:.]/g, "-")}.jibackup`;
const filePath = join(backupDirectory, filename);
writeFileSync(filePath, JSON.stringify(envelope), { mode: 0o600, flag: "wx" });
const verification = decryptBackupFile(filePath, key);
if (verification.envelope.checksum !== envelope.checksum || verification.payload.tenant.id !== tenant.id) {
  throw new Error("A verificação imediata do backup falhou.");
}
const sizeBytes = statSync(filePath).size;
const rowCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
const fileSha256 = createHash("sha256").update(JSON.stringify(envelope)).digest("hex");
const { error: recordError } = await supabase.from("backup_runs").insert({
  tenant_id: tenant.id,
  status: "verified",
  backup_type: "logical_encrypted",
  storage_label: filename,
  file_sha256: fileSha256,
  key_fingerprint: envelope.keyFingerprint,
  size_bytes: sizeBytes,
  table_count: Object.keys(tables).length,
  row_count: rowCount,
  media_count: media.length,
  actor_email: process.env.JUNIOR_BACKUP_ACTOR?.trim() || "codex-local",
  notes: "Backup lógico criptografado criado pela rotina operacional.",
  verified_at: new Date().toISOString(),
});
if (recordError) throw new Error(`O arquivo foi criado, mas o registro remoto falhou: ${recordError.message}`);

console.log(JSON.stringify({ status: "ok", filePath, sizeBytes, rowCount, tableCount: Object.keys(tables).length, mediaCount: media.length, keySource, keyFingerprint: envelope.keyFingerprint }));
