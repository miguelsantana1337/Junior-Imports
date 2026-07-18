import { describe, expect, it } from "vitest";
import { auditChanges } from "./audit-log";

describe("comparação da auditoria", () => {
  it("mostra apenas campos alterados e ignora metadados operacionais", () => {
    expect(auditChanges({
      beforeData: { name: "Produto A", active: false, tenant_id: "tenant", updated_at: "before" },
      afterData: { name: "Produto A", active: true, tenant_id: "tenant", updated_at: "after" },
    })).toEqual([{ key: "active", before: "Não", after: "Sim" }]);
  });

  it("mascara segredos mesmo quando o banco os envia no snapshot", () => {
    const changes = auditChanges({
      beforeData: { api_key: "old", recovery_token: "one" },
      afterData: { api_key: "new", recovery_token: "two" },
    });

    expect(changes).toEqual([
      { key: "api_key", before: "[valor protegido]", after: "[valor protegido]" },
      { key: "recovery_token", before: "[valor protegido]", after: "[valor protegido]" },
    ]);
  });
});
