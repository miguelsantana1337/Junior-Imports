import { describe, expect, it } from "vitest";
import type { ReportResult } from "./reporting";
import { reportToCsv, reportToPdf, reportToXlsx } from "./report-export";

const report: ReportResult = {
  type: "sales",
  title: "Vendas e pedidos",
  periodLabel: "2026-07-01 a 2026-07-31",
  columns: [{ key: "name", label: "Cliente", format: "text" }, { key: "total", label: "Total", format: "money" }],
  rows: [{ name: "Ana; Maria", total: 120.5 }],
  metrics: [{ key: "revenue", label: "Receita", value: 120.5, format: "money" }],
  comparison: {},
  series: [],
};

describe("exportação de relatórios", () => {
  it("gera CSV com BOM e campos protegidos", () => {
    const csv = reportToCsv(report);
    expect(csv.startsWith("\uFEFFCliente;Total")).toBe(true);
    expect(csv).toContain('"Ana; Maria"');
  });

  it("gera uma planilha XLSX em contêiner ZIP válido", () => {
    const bytes = reportToXlsx(report);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(bytes)).toContain("xl/workbook.xml");
  });

  it("gera um PDF com catálogo e tabela xref", () => {
    const content = new TextDecoder("latin1").decode(reportToPdf(report));
    expect(content.startsWith("%PDF-1.4")).toBe(true);
    expect(content).toContain("/Type /Catalog");
    expect(content).toContain("startxref");
  });
});
