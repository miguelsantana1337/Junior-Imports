// @vitest-environment node

import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
// @ts-expect-error O módulo operacional é JavaScript e validado diretamente neste teste.
import { backupFormat, decryptBackupFile, keyFingerprint } from "../../scripts/backup-lib.mjs";

describe("compatibilidade do backup binário v2", () => {
  it("desembrulha a chave, autentica, descomprime e valida o payload", () => {
    const masterKey = randomBytes(32);
    const dataKey = randomBytes(32);
    const wrapIv = randomBytes(12);
    const wrapCipher = createCipheriv("aes-256-gcm", masterKey, wrapIv);
    const wrappedKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
    const payload = {
      format: "junior-imports-logical-payload",
      version: 2,
      createdAt: "2026-07-19T12:00:00.000Z",
      tenant: { id: "tenant-1", slug: "junior-imports", name: "Junior Imports" },
      tables: { tenants: [{ id: "tenant-1" }], products: [] },
      media: [],
    };
    const plain = Buffer.from(JSON.stringify(payload));
    const compressed = gzipSync(plain);
    const contentIv = randomBytes(12);
    const contentCipher = createCipheriv("aes-256-gcm", dataKey, contentIv);
    const encrypted = Buffer.concat([contentCipher.update(compressed), contentCipher.final(), contentCipher.getAuthTag()]);
    const header = {
      format: backupFormat,
      version: 2,
      createdAt: payload.createdAt,
      tenant: payload.tenant,
      algorithm: "aes-256-gcm+gzip",
      keyFingerprint: keyFingerprint(masterKey),
      keyWrap: {
        algorithm: "aes-256-gcm",
        iv: wrapIv.toString("base64"),
        authTag: wrapCipher.getAuthTag().toString("base64"),
        ciphertext: wrappedKey.toString("base64"),
        keyFingerprint: keyFingerprint(masterKey),
      },
      checksum: createHash("sha256").update(plain).digest("hex"),
      compressedChecksum: createHash("sha256").update(compressed).digest("hex"),
      iv: contentIv.toString("base64"),
      ciphertextLength: encrypted.length,
    };
    const headerBytes = Buffer.from(JSON.stringify(header));
    const headerLength = Buffer.alloc(4);
    headerLength.writeUInt32BE(headerBytes.length);
    const directory = mkdtempSync(join(tmpdir(), "junior-backup-v2-"));
    const filePath = join(directory, "backup.jibackup");
    try {
      writeFileSync(filePath, Buffer.concat([Buffer.from("JIBACKUP2\n"), headerLength, headerBytes, encrypted]));
      const restored = decryptBackupFile(filePath, masterKey);
      expect(restored.payload).toEqual(payload);
      expect(restored.envelope.keyFingerprint).toBe(keyFingerprint(masterKey));
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
