import { describe, expect, it } from "vitest";
import { isPresenceOnline, parseMentions } from "./collaboration";

describe("team collaboration", () => {
  it("extracts unique mentions", () => {
    expect(parseMentions("Revisar com @junior e @time@junior.test; @junior novamente")).toEqual(["junior", "time@junior.test"]);
  });

  it("expires presence after ninety seconds", () => {
    const now = new Date("2026-07-18T12:00:00Z");
    expect(isPresenceOnline("2026-07-18T11:59:00Z", now)).toBe(true);
    expect(isPresenceOnline("2026-07-18T11:58:00Z", now)).toBe(false);
  });
});

