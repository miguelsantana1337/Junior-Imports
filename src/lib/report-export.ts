import { slugify } from "@/lib/format";
import type { ReportColumn, ReportResult, ReportValue } from "@/lib/reporting";
import type { ReportFormat } from "@/types/store";

const utf8 = new TextEncoder();

function displayValue(value: ReportValue, column: ReportColumn) {
  if (typeof value !== "number") return value;
  if (column.format === "money") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  if (column.format === "percent") return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function csvCell(value: string) {
  return /[;"\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function reportToCsv(report: ReportResult) {
  const lines = [
    report.columns.map((column) => csvCell(column.label)).join(";"),
    ...report.rows.map((row) => report.columns.map((column) => csvCell(String(displayValue(row[column.key] ?? "", column)))).join(";")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}

function xml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function excelColumn(index: number) {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function worksheetXml(report: ReportResult) {
  const header = report.columns.map((column, index) => `<c r="${excelColumn(index)}1" t="inlineStr" s="1"><is><t>${xml(column.label)}</t></is></c>`).join("");
  const body = report.rows.map((row, rowIndex) => {
    const cells = report.columns.map((column, columnIndex) => {
      const value = row[column.key] ?? "";
      const ref = `${excelColumn(columnIndex)}${rowIndex + 2}`;
      if (typeof value === "number") return `<c r="${ref}" t="n"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 2}">${cells}</row>`;
  }).join("");
  const widths = report.columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${Math.min(42, Math.max(12, column.label.length + 4))}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${excelColumn(Math.max(0, report.columns.length - 1))}${Math.max(1, report.rows.length + 1)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths}</cols><sheetData><row r="1">${header}</row>${body}</sheetData><autoFilter ref="A1:${excelColumn(Math.max(0, report.columns.length - 1))}${Math.max(1, report.rows.length + 1)}"/></worksheet>`;
}

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function push16(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff);
}

function push32(target: number[], value: number) {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function zipStore(files: Array<{ name: string; content: string }>) {
  const output: number[] = [];
  const central: number[] = [];
  files.forEach((file) => {
    const name = utf8.encode(file.name);
    const content = utf8.encode(file.content);
    const checksum = crc32(content);
    const offset = output.length;
    push32(output, 0x04034b50); push16(output, 20); push16(output, 0); push16(output, 0); push16(output, 0); push16(output, 0);
    push32(output, checksum); push32(output, content.length); push32(output, content.length); push16(output, name.length); push16(output, 0);
    output.push(...name, ...content);
    push32(central, 0x02014b50); push16(central, 20); push16(central, 20); push16(central, 0); push16(central, 0); push16(central, 0); push16(central, 0);
    push32(central, checksum); push32(central, content.length); push32(central, content.length); push16(central, name.length); push16(central, 0); push16(central, 0);
    push16(central, 0); push16(central, 0); push32(central, 0); push32(central, offset); central.push(...name);
  });
  const centralOffset = output.length;
  output.push(...central);
  push32(output, 0x06054b50); push16(output, 0); push16(output, 0); push16(output, files.length); push16(output, files.length);
  push32(output, central.length); push32(output, centralOffset); push16(output, 0);
  return Uint8Array.from(output);
}

export function reportToXlsx(report: ReportResult) {
  const files = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xml(report.title.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Aptos"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Aptos"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1E5EFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>` },
    { name: "xl/worksheets/sheet1.xml", content: worksheetXml(report) },
  ];
  return zipStore(files);
}

function pdfSafe(value: string) {
  return value
    .replaceAll("–", "-").replaceAll("—", "-").replaceAll("•", "-").replaceAll("“", '"').replaceAll("”", '"')
    .replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)")
    .split("").map((character) => character.charCodeAt(0) <= 255 ? character : "?").join("");
}

function binaryBytes(value: string) {
  return Uint8Array.from(value.split("").map((character) => character.charCodeAt(0) & 0xff));
}

export function reportToPdf(report: ReportResult) {
  const metrics = report.metrics.map((metric) => `${metric.label}: ${displayValue(metric.value, { key: metric.key, label: metric.label, format: metric.format })}`);
  const rows = report.rows.map((row) => report.columns.map((column) => `${column.label}: ${displayValue(row[column.key] ?? "", column)}`).join(" | "));
  const allLines = [report.title, report.periodLabel, "", ...metrics, "", ...rows].map((line) => {
    const safe = pdfSafe(line);
    const chunks: string[] = [];
    for (let index = 0; index < safe.length; index += 105) chunks.push(safe.slice(index, index + 105));
    return chunks.length ? chunks : [""];
  }).flat();
  const pages: string[][] = [];
  for (let index = 0; index < allLines.length; index += 48) pages.push(allLines.slice(index, index + 48));
  if (!pages.length) pages.push([report.title]);
  const pageIds = pages.map((_, index) => 4 + index * 2);
  const objects: string[] = [];
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  pages.forEach((lines, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const content = `BT /F1 9 Tf 36 806 Td 0 -14 Td ${lines.map((line) => `(${line}) Tj 0 -14 Td`).join(" ")} ET`;
    objects[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${binaryBytes(content).length} >>\nstream\n${content}\nendstream`;
  });
  let pdf = "%PDF-1.4\n%âãÏÓ\n";
  const offsets = [0];
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = binaryBytes(pdf).length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = binaryBytes(pdf).length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return binaryBytes(pdf);
}

export function createReportFile(report: ReportResult, format: ReportFormat, reportName = report.title) {
  const date = new Date().toISOString().slice(0, 10);
  const fileName = `${slugify(reportName) || "relatorio"}-${date}.${format}`;
  if (format === "csv") return { fileName, blob: new Blob([reportToCsv(report)], { type: "text/csv;charset=utf-8" }) };
  if (format === "xlsx") return { fileName, blob: new Blob([reportToXlsx(report)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }) };
  return { fileName, blob: new Blob([reportToPdf(report)], { type: "application/pdf" }) };
}

export function downloadReportFile(report: ReportResult, format: ReportFormat, reportName?: string) {
  const file = createReportFile(report, format, reportName);
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return file.fileName;
}
