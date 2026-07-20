export type BrowserBackupProgress = {
  phase: "media" | "packing" | "encrypting" | "verifying" | "ready";
  current: number;
  total: number;
  label: string;
};

export type PreparedBrowserBackup = {
  filename: string;
  dataKey: string;
  keyWrap: {
    algorithm: "aes-256-gcm";
    iv: string;
    authTag: string;
    ciphertext: string;
    keyFingerprint: string;
  };
  payload: {
    format: "junior-imports-logical-payload";
    version: 2;
    createdAt: string;
    tenant: Record<string, unknown> & { id: string; slug: string; name: string };
    tables: Record<string, unknown[]>;
    limitations: string[];
  };
  mediaSources: Array<{
    bucket: string;
    path: string;
    contentType: string;
    sizeBytes: number;
    signedUrl: string;
  }>;
};

const magic = new TextEncoder().encode("JIBACKUP2\n");

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32_768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32_768));
  }
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(bytes: BufferSource) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, (value) => value.toString(16).padStart(2, "0")).join("");
}

async function gzip(bytes: Uint8Array) {
  if (typeof CompressionStream === "undefined") throw new Error("Este navegador não oferece a compactação segura necessária.");
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const stream = new Blob([copy]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function createEncryptedBrowserBackup(
  prepared: PreparedBrowserBackup,
  onProgress: (progress: BrowserBackupProgress) => void,
) {
  const media: Array<{ bucket: string; path: string; contentType: string; data: string }> = [];
  const totalMedia = prepared.mediaSources.length;
  for (let index = 0; index < totalMedia; index += 1) {
    const source = prepared.mediaSources[index];
    onProgress({ phase: "media", current: index, total: totalMedia, label: `Baixando mídia ${index + 1} de ${totalMedia}` });
    const response = await fetch(source.signedUrl, { cache: "no-store", credentials: "omit" });
    if (!response.ok) throw new Error(`Não foi possível incluir ${source.path} no backup.`);
    const data = new Uint8Array(await response.arrayBuffer());
    media.push({ bucket: source.bucket, path: source.path, contentType: source.contentType || response.headers.get("content-type") || "application/octet-stream", data: bytesToBase64(data) });
  }

  onProgress({ phase: "packing", current: totalMedia, total: totalMedia, label: "Compactando dados e mídias" });
  const payload = { ...prepared.payload, media };
  const plain = new TextEncoder().encode(JSON.stringify(payload));
  const payloadChecksum = await sha256(plain);
  const compressed = await gzip(plain);
  const compressedChecksum = await sha256(compressed);

  onProgress({ phase: "encrypting", current: totalMedia, total: totalMedia, label: "Criptografando o pacote" });
  const rawKey = base64ToBytes(prepared.dataKey);
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, compressed));

  onProgress({ phase: "verifying", current: totalMedia, total: totalMedia, label: "Verificando a integridade" });
  const verifiedCompressed = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, ciphertext));
  if (await sha256(verifiedCompressed) !== compressedChecksum) throw new Error("A verificação de integridade do backup falhou.");

  const header = {
    format: "junior-imports-encrypted-backup",
    version: 2,
    createdAt: prepared.payload.createdAt,
    tenant: {
      id: prepared.payload.tenant.id,
      slug: prepared.payload.tenant.slug,
      name: prepared.payload.tenant.name,
    },
    algorithm: "aes-256-gcm+gzip",
    keyFingerprint: prepared.keyWrap.keyFingerprint,
    keyWrap: prepared.keyWrap,
    checksum: payloadChecksum,
    compressedChecksum,
    iv: bytesToBase64(iv),
    ciphertextLength: ciphertext.length,
  };
  const headerBytes = new TextEncoder().encode(JSON.stringify(header));
  const headerLength = new Uint8Array(4);
  new DataView(headerLength.buffer).setUint32(0, headerBytes.length, false);
  const packageBytes = new Uint8Array(magic.length + headerLength.length + headerBytes.length + ciphertext.length);
  packageBytes.set(magic, 0);
  packageBytes.set(headerLength, magic.length);
  packageBytes.set(headerBytes, magic.length + headerLength.length);
  packageBytes.set(ciphertext, magic.length + headerLength.length + headerBytes.length);
  const fileSha256 = await sha256(packageBytes);
  rawKey.fill(0);
  verifiedCompressed.fill(0);

  onProgress({ phase: "ready", current: totalMedia, total: totalMedia, label: "Backup verificado e pronto" });
  return {
    blob: new Blob([packageBytes], { type: "application/octet-stream" }),
    filename: prepared.filename,
    fileSha256,
    sizeBytes: packageBytes.length,
    payloadChecksum,
  };
}

export function downloadBackupFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
