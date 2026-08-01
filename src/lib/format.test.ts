import { describe, expect, it } from "vitest";
import { formatDateTime, formatStoreDateKey, formatStoreHour, whatsappUrl } from "./format";

describe("formatação operacional", () => {
  it("usa o fuso de São Paulo de forma estável", () => {
    const timestamp = "2026-07-20T02:30:00.000Z";
    expect(formatDateTime(timestamp)).toContain("19/07/2026");
    expect(formatDateTime(timestamp)).toContain("23:30");
    expect(formatStoreDateKey(timestamp)).toBe("2026-07-19");
    expect(formatStoreHour(timestamp)).toBe(23);
  });

  it("normaliza um WhatsApp brasileiro salvo sem código do país", () => {
    expect(new URL(whatsappUrl("(31) 98904-7131")).pathname).toBe("/5531989047131");
  });
});
