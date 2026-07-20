import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const backupLibrary = readFileSync(resolve(process.cwd(), "scripts/backup-lib.mjs"), "utf8");
const backupRunner = readFileSync(resolve(process.cwd(), "scripts/backup-database.mjs"), "utf8");

describe("cobertura do backup operacional", () => {
  it.each([
    "collaboration_threads",
    "collaboration_comments",
    "collaboration_reads",
    "approval_requests",
    "admin_notification_states",
    "copilot_usage",
  ])("inclui %s no backup e na restauração", (table) => {
    expect(backupLibrary.match(new RegExp(`\\"${table}\\"`, "g"))).toHaveLength(2);
  });

  it("pagina e percorre pastas de mídia", () => {
    expect(backupRunner).toContain("offset,");
    expect(backupRunner).toContain("await fetchFolder(bucket, path)");
    expect(backupRunner).toContain("objects.length < 1000");
  });
});
