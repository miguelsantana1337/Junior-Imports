// @vitest-environment node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createEncryptedBrowserBackup, type PreparedBrowserBackup } from "./browser-backup";

describe("backup administrativo protegido", () => {
  it("exige nova verificação MFA no servidor e limita a operação ao proprietário", () => {
    const route = readFileSync(
      resolve(process.cwd(), "src/app/api/admin/backups/prepare/route.ts"),
      "utf8",
    );
    expect(route).toContain('requireAdmin("data")');
    expect(route).toContain('actor.role !== "owner"');
    expect(route).toContain("sessionClient.auth.mfa.challengeAndVerify");
    expect(route).toContain("parsed.data.code");
    expect(route).toContain('"Cache-Control": "private, no-store, max-age=0"');
    expect(route).not.toContain("process.env.SUPABASE_SERVICE_ROLE_KEY!");
  });

  it("monta um pacote binário v2, criptografado e verificado", async () => {
    const key = new Uint8Array(32);
    crypto.getRandomValues(key);
    const prepared: PreparedBrowserBackup = {
      filename: "teste.jibackup",
      dataKey: Buffer.from(key).toString("base64"),
      keyWrap: {
        algorithm: "aes-256-gcm",
        iv: Buffer.alloc(12).toString("base64"),
        authTag: Buffer.alloc(16).toString("base64"),
        ciphertext: Buffer.alloc(32).toString("base64"),
        keyFingerprint: "1234567890abcdef",
      },
      payload: {
        format: "junior-imports-logical-payload",
        version: 2,
        createdAt: "2026-07-19T12:00:00.000Z",
        tenant: { id: "tenant-1", slug: "junior-imports", name: "Junior Imports" },
        tables: { tenants: [{ id: "tenant-1" }], products: [] },
        limitations: [],
      },
      mediaSources: [],
    };
    const progress: string[] = [];
    const result = await createEncryptedBrowserBackup(prepared, (item) => progress.push(item.phase));
    const bytes = new Uint8Array(await result.blob.arrayBuffer());
    expect(new TextDecoder().decode(bytes.subarray(0, 10))).toBe("JIBACKUP2\n");
    expect(result.fileSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.payloadChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(progress).toEqual(["packing", "encrypting", "verifying", "ready"]);
  });
});
