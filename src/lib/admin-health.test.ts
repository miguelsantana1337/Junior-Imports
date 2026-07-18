import { describe, expect, it } from "vitest";
import { backupFreshness, deriveHealthStatus, healthEnvironment } from "./admin-health";

describe("saúde operacional do painel", () => {
  it("prioriza o estado mais grave", () => {
    expect(deriveHealthStatus([{ status: "healthy" }, { status: "warning" }, { status: "unknown" }])).toBe("warning");
    expect(deriveHealthStatus([{ status: "warning" }, { status: "critical" }])).toBe("critical");
  });

  it("classifica a idade do último backup", () => {
    const now = new Date("2026-07-18T12:00:00.000Z").getTime();
    expect(backupFreshness("2026-07-18T00:00:00.000Z", now)).toBe("healthy");
    expect(backupFreshness("2026-07-16T12:00:00.000Z", now)).toBe("warning");
    expect(backupFreshness("2026-07-10T12:00:00.000Z", now)).toBe("critical");
    expect(backupFreshness(null, now)).toBe("critical");
  });

  it("normaliza o ambiente de execução", () => {
    expect(healthEnvironment("production")).toBe("production");
    expect(healthEnvironment("preview")).toBe("preview");
    expect(healthEnvironment(undefined)).toBe("local");
  });
});
