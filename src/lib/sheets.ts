import { readSheet } from "read-excel-file/node";

/** Turn an uploaded spreadsheet into plain text rows the AI can read. */
export async function sheetToText(fileName: string, data: Buffer): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv")) {
    return data.toString("utf8").slice(0, 20000);
  }
  if (lower.endsWith(".xlsx")) {
    const rows = await readSheet(data);
    return rows
      .map((r) => r.map((c) => (c === null || c === undefined ? "" : String(c))).join(", "))
      .join("\n")
      .slice(0, 20000);
  }
  throw new Error(`${fileName}: only .csv and .xlsx spreadsheets can be read.`);
}
