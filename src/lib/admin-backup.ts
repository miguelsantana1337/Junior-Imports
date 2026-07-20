import "server-only";

import { createCipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AdminSessionUser } from "@/lib/require-admin";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = NonNullable<ReturnType<typeof createAdminClient>>;

export const tenantBackupTables = [
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
  "saved_reports",
  "export_runs",
  "store_pages",
  "page_blocks",
  "marketing_publications",
  "marketing_publication_versions",
  "message_automations",
  "automation_runs",
  "message_logs",
  "order_stock_reservations",
  "storefront_order_requests",
  "collaboration_threads",
  "collaboration_comments",
  "collaboration_reads",
  "approval_requests",
  "admin_notification_states",
  "copilot_usage",
  "audit_logs",
  "backup_runs",
] as const;

const mediaBuckets = ["product-media", "banner-media", "site-media"] as const;

export type BackupMediaSource = {
  bucket: string;
  path: string;
  contentType: string;
  sizeBytes: number;
  signedUrl: string;
};

export type BackupKeyWrap = {
  algorithm: "aes-256-gcm";
  iv: string;
  authTag: string;
  ciphertext: string;
  keyFingerprint: string;
};

type StorageObject = {
  id?: string | null;
  name: string;
  metadata?: { mimetype?: string; size?: number } | null;
};

async function fetchAll(admin: AdminClient, table: string, column: string, value: string) {
  const rows: unknown[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from(table).select("*").eq(column, value).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function listBucketObjects(admin: AdminClient, bucket: string, folder: string): Promise<Array<Omit<BackupMediaSource, "signedUrl">>> {
  const result: Array<Omit<BackupMediaSource, "signedUrl">> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(folder, {
      limit: 1000,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw new Error(`${bucket}/${folder}: ${error.message}`);
    const objects = (data ?? []) as StorageObject[];
    for (const object of objects) {
      const path = `${folder}/${object.name}`;
      if (!object.id) {
        result.push(...await listBucketObjects(admin, bucket, path));
        continue;
      }
      result.push({
        bucket,
        path,
        contentType: object.metadata?.mimetype || "application/octet-stream",
        sizeBytes: Number(object.metadata?.size) || 0,
      });
    }
    if (objects.length < 1000) break;
  }
  return result;
}

async function createMediaManifest(admin: AdminClient, tenantId: string) {
  const media: BackupMediaSource[] = [];
  for (const bucket of mediaBuckets) {
    const objects = await listBucketObjects(admin, bucket, tenantId);
    for (let index = 0; index < objects.length; index += 100) {
      const batch = objects.slice(index, index + 100);
      const { data, error } = await admin.storage.from(bucket).createSignedUrls(
        batch.map((item) => item.path),
        60 * 60,
      );
      if (error) throw new Error(`${bucket}: ${error.message}`);
      for (let itemIndex = 0; itemIndex < batch.length; itemIndex += 1) {
        const signed = data?.[itemIndex];
        if (!signed?.signedUrl || signed.error) {
          throw new Error(`${bucket}/${batch[itemIndex].path}: não foi possível autorizar o download`);
        }
        media.push({ ...batch[itemIndex], signedUrl: signed.signedUrl });
      }
    }
  }
  return media;
}

export async function buildTenantBackupManifest(admin: AdminClient, actor: AdminSessionUser) {
  const { data: tenant, error: tenantError } = await admin.from("tenants").select("*").eq("id", actor.tenantId).maybeSingle();
  if (tenantError || !tenant) throw new Error(tenantError?.message ?? "Tenant não encontrado.");

  const tables: Record<string, unknown[]> = { tenants: [tenant] };
  for (const table of tenantBackupTables) tables[table] = await fetchAll(admin, table, "tenant_id", actor.tenantId);
  tables.tenant_domains = await fetchAll(admin, "tenant_domains", "tenant_id", actor.tenantId);
  tables.tenant_members = await fetchAll(admin, "tenant_members", "tenant_id", actor.tenantId);

  const memberIds = [...new Set((tables.tenant_members as Array<{ user_id?: string }>).map((member) => member.user_id).filter((id): id is string => Boolean(id)))];
  if (memberIds.length) {
    const { data, error } = await admin.from("profiles").select("*").in("id", memberIds);
    if (error) throw new Error(`profiles: ${error.message}`);
    tables.profiles = data ?? [];
  } else {
    tables.profiles = [];
  }

  const mediaSources = await createMediaManifest(admin, actor.tenantId);
  const createdAt = new Date().toISOString();
  const rowCount = Object.values(tables).reduce((sum, rows) => sum + rows.length, 0);
  return {
    createdAt,
    tenant,
    tables,
    mediaSources,
    summary: {
      tableCount: Object.keys(tables).length,
      rowCount,
      mediaCount: mediaSources.length,
      mediaBytes: mediaSources.reduce((sum, item) => sum + item.sizeBytes, 0),
    },
  };
}

export function resolveBackupMasterKey() {
  const encoded = process.env.JUNIOR_BACKUP_KEY?.trim();
  if (!encoded) throw new Error("A chave de backup do painel não está configurada.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("A chave de backup do painel é inválida.");
  return key;
}

export function createWrappedBackupKey(masterKey = resolveBackupMasterKey()) {
  const dataKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);
  const keyWrap: BackupKeyWrap = {
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    keyFingerprint: createHash("sha256").update(masterKey).digest("hex").slice(0, 16),
  };
  return { dataKey: dataKey.toString("base64"), keyWrap };
}

type CompletionProof = {
  runId: string;
  actorId: string;
  tenantId: string;
  expiresAt: number;
};

function backupProofSecret() {
  const secret = process.env.STOREFRONT_SECURITY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Assinatura de segurança indisponível.");
  return secret;
}

export function issueBackupCompletionToken(proof: Omit<CompletionProof, "expiresAt">, secret = backupProofSecret()) {
  const payload: CompletionProof = { ...proof, expiresAt: Date.now() + 60 * 60 * 1000 };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function verifyBackupCompletionToken(token: string, expected: Omit<CompletionProof, "expiresAt">, secret = backupProofSecret()) {
  const [encoded, receivedSignature] = token.split(".");
  if (!encoded || !receivedSignature) return false;
  const expectedSignature = createHmac("sha256", secret).update(encoded).digest("base64url");
  const received = Buffer.from(receivedSignature);
  const signed = Buffer.from(expectedSignature);
  if (received.length !== signed.length || !timingSafeEqual(received, signed)) return false;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as CompletionProof;
    return payload.runId === expected.runId
      && payload.actorId === expected.actorId
      && payload.tenantId === expected.tenantId
      && payload.expiresAt > Date.now();
  } catch {
    return false;
  }
}
