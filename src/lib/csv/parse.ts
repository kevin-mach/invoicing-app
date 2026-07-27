export type ImportField = {
  key: string;
  label: string;
  required?: boolean;
  aliases: string[];
};

export type ImportResult = { inserted: number; skipped: number; error?: string };

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

/** Reads the first sheet of a .csv or .xlsx file into an array of row objects keyed by header. */
export async function parseSpreadsheetFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false });
}

/** Maps raw spreadsheet rows onto known fields by fuzzy header matching; drops rows missing a required field. */
export function mapRows(
  rawRows: Record<string, string>[],
  fields: ImportField[]
): { rows: Record<string, string>[]; skippedCount: number } {
  if (!rawRows.length) return { rows: [], skippedCount: 0 };

  const headerMap = new Map<string, string>();
  for (const header of Object.keys(rawRows[0])) {
    const norm = normalizeHeader(header);
    const field = fields.find((f) => f.aliases.some((a) => normalizeHeader(a) === norm));
    if (field) headerMap.set(header, field.key);
  }

  const mapped: Record<string, string>[] = [];
  let skippedCount = 0;

  for (const raw of rawRows) {
    const row: Record<string, string> = {};
    for (const [header, value] of Object.entries(raw)) {
      const fieldKey = headerMap.get(header);
      if (fieldKey) row[fieldKey] = String(value ?? "").trim();
    }
    const hasRequired = fields.filter((f) => f.required).every((f) => row[f.key]?.trim());
    if (hasRequired) mapped.push(row);
    else skippedCount++;
  }

  return { rows: mapped, skippedCount };
}

export function buildTemplateCsv(fields: ImportField[]): string {
  return fields.map((f) => f.label).join(",") + "\n";
}
